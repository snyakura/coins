import { friendlyMessage, isDefiniteRejection } from "@/lib/deriv/errors";
import { DerivApiError, type TransferResult } from "@/lib/deriv/types";
import {
  type Actor, type Ctx, MAX_DEPOSIT, METHODS, MIN_AMOUNT, ServiceError, dayStamp, fromCents, parseAmount, parseCurrency, randomId, toCents,
} from "./common";
import { sniffProof } from "./files";
import { DEPOSIT_TRANSITIONS, assertTransition, type DepositStatus } from "./state";
import type { Row } from "./repo";

const NICK = /^[A-Za-z0-9_.-]{2,64}$/;

async function audit(ctx: Ctx, action: string, d: Row, from: string | null, to: string | null, adminId?: string, note?: string) {
  await ctx.repo.audit({ action, user_id: d.user_id, admin_id: adminId ?? null, entity: "deposit", entity_id: d.id,
    previous_status: from, new_status: to, provider_ref: d.deriv_transaction_id ?? d.deriv_request_id, note: note ?? null });
}

/** Move a deposit between statuses atomically. Throws 409 if someone else already moved it. */
async function move(ctx: Ctx, id: string, from: DepositStatus | DepositStatus[], to: DepositStatus, patch: Row = {}) {
  for (const f of ([] as DepositStatus[]).concat(from)) assertTransition(DEPOSIT_TRANSITIONS, f, to);
  const row = await ctx.repo.cas("deposits", id, from, { ...patch, status: to });
  if (!row) throw new ServiceError(409, "This deposit has already been processed.", "ALREADY_PROCESSED");
  return row;
}

export async function createDeposit(ctx: Ctx, userId: string, input: { amount: unknown; currency: unknown; paymentMethod: unknown; derivNickname: unknown }) {
  const amount = parseAmount(input.amount);
  const currency = parseCurrency(input.currency);
  if (amount < MIN_AMOUNT || amount > MAX_DEPOSIT) throw new ServiceError(400, `Deposits must be between $${MIN_AMOUNT} and $${MAX_DEPOSIT}.`, "AMOUNT_RANGE");
  if (typeof input.paymentMethod !== "string" || !(METHODS as readonly string[]).includes(input.paymentMethod))
    throw new ServiceError(400, "Please choose a payment method.", "INVALID_METHOD");
  const nick = typeof input.derivNickname === "string" ? input.derivNickname.trim() : "";
  if (!NICK.test(nick)) throw new ServiceError(400, "Please enter a valid Deriv nickname.", "INVALID_NICKNAME");

  const gross = toCents(amount);
  const fee = gross <= toCents(10) ? toCents(1) : Math.round(gross * (ctx.depositFeePercent / 100)); // $1 flat up to $10, otherwise the percentage
  const net = gross - fee;
  const requestId = `DEP-${dayStamp(ctx.now())}-${randomId()}`;

  // Pre-flight with Deriv's dry_run so an unknown nickname is caught before the customer pays us.
  try {
    await ctx.deriv.transfer({ toNickname: nick, amount: fromCents(net), currency, requestId, dryRun: true });
  } catch (e) {
    if (isDefiniteRejection(e)) throw new ServiceError(400, friendlyMessage(e), (e as DerivApiError).code, (e as Error).message);
    // Uncertain (timeout/5xx): don't block the customer; the real transfer is validated again at approval.
  }

  const dep = await ctx.repo.insert("deposits", {
    user_id: userId, amount: fromCents(gross), fee: fromCents(fee), net_amount: fromCents(net), currency,
    payment_method: input.paymentMethod, deriv_nickname: nick, status: "PENDING_PAYMENT", deriv_request_id: requestId,
  });
  await ctx.repo.upsertLedger({
    user_id: userId, type: "EXTERNAL_DEPOSIT", direction: "IN", amount: fromCents(gross), currency, status: "PENDING",
    provider: "external", provider_request_id: requestId, payment_method: input.paymentMethod, metadata: { deposit_id: dep.id },
  });
  await audit(ctx, "DEPOSIT_CREATED", dep, null, "PENDING_PAYMENT");
  return dep;
}

export async function getOwnDeposit(ctx: Ctx, actor: Actor, id: string) {
  const d = await ctx.repo.get("deposits", id);
  if (!d || (d.user_id !== actor.id && !actor.isAdmin)) throw new ServiceError(404, "Deposit not found.", "NOT_FOUND");
  return d;
}

export async function submitProof(ctx: Ctx, userId: string, id: string, input: { reference: unknown; file: { bytes: Uint8Array } }) {
  const d = await ctx.repo.get("deposits", id);
  if (!d || d.user_id !== userId) throw new ServiceError(404, "Deposit not found.", "NOT_FOUND");
  if (d.status !== "PENDING_PAYMENT") throw new ServiceError(409, "Proof has already been submitted for this deposit.", "ALREADY_PROCESSED");
  const ref = typeof input.reference === "string" ? input.reference.trim() : "";
  if (ref.length < 3 || ref.length > 64) throw new ServiceError(400, "Please enter the payment reference from your receipt.", "INVALID_REFERENCE");
  const dup = (await ctx.repo.list("deposits", {}, 1000)).find((x) => x.id !== id && String(x.payment_reference ?? "").toLowerCase() === ref.toLowerCase());
  if (dup) throw new ServiceError(409, "That payment reference has already been used.", "DUPLICATE_REFERENCE");
  const sniffed = sniffProof(input.file.bytes);
  const path = await ctx.saveProof(userId, id, { bytes: input.file.bytes, ...sniffed });
  const row = await move(ctx, id, "PENDING_PAYMENT", "PAYMENT_SUBMITTED", { payment_reference: ref, proof_path: path });
  await audit(ctx, "PROOF_SUBMITTED", row, "PENDING_PAYMENT", "PAYMENT_SUBMITTED");
  return row;
}

export async function cancelDeposit(ctx: Ctx, userId: string, id: string) {
  const d = await ctx.repo.get("deposits", id);
  if (!d || d.user_id !== userId) throw new ServiceError(404, "Deposit not found.", "NOT_FOUND");
  const row = await move(ctx, id, ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"], "CANCELLED");
  await ctx.repo.updateLedger("EXTERNAL_DEPOSIT", d.deriv_request_id, { status: "CANCELLED" });
  await audit(ctx, "DEPOSIT_CANCELLED", row, d.status, "CANCELLED");
  return row;
}

function requireAdmin(a: Actor) { if (!a.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN"); }

/** Staff can only act on a deposit once the client's proof has reached this server. Gives the staff dashboard a specific answer instead of a vague "already processed". */
async function requireProofSubmitted(ctx: Ctx, id: string) {
  const d = await ctx.repo.get("deposits", id);
  if (!d) throw new ServiceError(404, "Deposit not found.", "NOT_FOUND");
  if (d.status === "PENDING_PAYMENT") throw new ServiceError(409, "The client hasn't uploaded proof of payment for this deposit yet.", "NO_PROOF");
}

export async function startReview(ctx: Ctx, admin: Actor, id: string) {
  requireAdmin(admin);
  const d = await ctx.repo.get("deposits", id);
  if (!d) throw new ServiceError(404, "Deposit not found.", "NOT_FOUND");
  if (d.status !== "PAYMENT_SUBMITTED") return d; // already under review or beyond: viewing is harmless
  const row = await move(ctx, id, "PAYMENT_SUBMITTED", "UNDER_REVIEW", { reviewed_by: admin.id });
  await audit(ctx, "ADMIN_REVIEW_STARTED", row, "PAYMENT_SUBMITTED", "UNDER_REVIEW", admin.id);
  return row;
}

export async function rejectDeposit(ctx: Ctx, admin: Actor, id: string, reason: string) {
  requireAdmin(admin);
  await requireProofSubmitted(ctx, id);
  await startReview(ctx, admin, id);
  const row = await move(ctx, id, "UNDER_REVIEW", "REJECTED", { error_message: reason.slice(0, 300), reviewed_by: admin.id });
  await ctx.repo.updateLedger("EXTERNAL_DEPOSIT", row.deriv_request_id, { status: "REJECTED" });
  await audit(ctx, "ADMIN_REJECTED_DEPOSIT", row, "UNDER_REVIEW", "REJECTED", admin.id, reason.slice(0, 300));
  return row;
}

/**
 * Approve the external payment and push the funds into the customer's Deriv wallet.
 * Idempotency: (1) two compare-and-set transitions mean only ONE caller can reach PROCESSING_DERIV;
 * (2) the request_id was stored at creation and is reused on every retry; Deriv answers RequestIDUsed for repeats.
 */
export async function approveDeposit(ctx: Ctx, admin: Actor, id: string) {
  requireAdmin(admin);
  await requireProofSubmitted(ctx, id);
  await startReview(ctx, admin, id);
  const verified = await move(ctx, id, "UNDER_REVIEW", "PAYMENT_VERIFIED", { verified_at: ctx.now().toISOString(), reviewed_by: admin.id });
  await ctx.repo.updateLedger("EXTERNAL_DEPOSIT", verified.deriv_request_id, { status: "VERIFIED" });
  await audit(ctx, "ADMIN_APPROVED_DEPOSIT", verified, "UNDER_REVIEW", "PAYMENT_VERIFIED", admin.id);
  const processing = await move(ctx, id, "PAYMENT_VERIFIED", "PROCESSING_DERIV");
  await ctx.repo.upsertLedger({
    user_id: processing.user_id, type: "DERIV_DEPOSIT", direction: "OUT", amount: processing.net_amount, currency: processing.currency,
    status: "PROCESSING", provider: "deriv", provider_request_id: processing.deriv_request_id, payment_method: processing.payment_method,
    metadata: { deposit_id: processing.id },
  });
  await audit(ctx, "DERIV_TRANSFER_REQUESTED", processing, "PAYMENT_VERIFIED", "PROCESSING_DERIV", admin.id);
  return sendTransfer(ctx, processing);
}

async function sendTransfer(ctx: Ctx, d: Row): Promise<Row> {
  try {
    const r = await ctx.deriv.transfer({ toNickname: d.deriv_nickname, amount: Number(d.net_amount).toFixed(2), currency: d.currency, requestId: d.deriv_request_id });
    return applyTransfer(ctx, d, r);
  } catch (e) {
    if (e instanceof DerivApiError && (e.uncertain || e.code === "RequestIDUsed")) {
      // Outcome unknown or already submitted: ASK Deriv, never blindly send again.
      console.error("[deriv] transfer outcome uncertain", d.deriv_request_id, (e as Error).message);
      return checkTransfer(ctx, d, false);
    }
    if (isDefiniteRejection(e)) {
      console.error("[deriv] transfer rejected", d.deriv_request_id, (e as DerivApiError).code, (e as Error).message);
      return failDeposit(ctx, d, e);
    }
    console.error("[deriv] transfer unexpected error", d.deriv_request_id, (e as Error).message);
    return ctx.repo.update("deposits", d.id, { error_message: "Awaiting Deriv confirmation" });
  }
}

async function failDeposit(ctx: Ctx, d: Row, e: unknown) {
  const code = e instanceof DerivApiError ? e.code : "UNKNOWN";
  const row = (await ctx.repo.cas("deposits", d.id, "PROCESSING_DERIV", { status: "FAILED", deriv_status: "failed", error_message: friendlyMessage(e) })) ?? d;
  await ctx.repo.updateLedger("DERIV_DEPOSIT", d.deriv_request_id, { status: "FAILED", metadata: { deposit_id: d.id, error_code: code } });
  await audit(ctx, "DERIV_TRANSFER_FAILED", row, "PROCESSING_DERIV", "FAILED", undefined, code);
  return row;
}

async function applyTransfer(ctx: Ctx, d: Row, r: TransferResult): Promise<Row> {
  if (r.status === "complete") {
    const row = (await ctx.repo.cas("deposits", d.id, "PROCESSING_DERIV", {
      status: "COMPLETED", deriv_status: "complete", deriv_transaction_id: r.transactionId, error_message: null,
    })) ?? (await ctx.repo.get("deposits", d.id))!;
    await ctx.repo.updateLedger("DERIV_DEPOSIT", d.deriv_request_id, { status: "COMPLETED", provider_transaction_id: r.transactionId });
    await audit(ctx, "DERIV_TRANSFER_COMPLETED", row, "PROCESSING_DERIV", "COMPLETED");
    return row;
  }
  if (r.status === "failed" || r.status === "rejected") return failDeposit(ctx, d, new DerivApiError("TransferFailed", "failed", 400));
  return ctx.repo.update("deposits", d.id, { deriv_status: String(r.status), error_message: null }); // pending: reconciler will re-check
}

async function checkTransfer(ctx: Ctx, d: Row, resendIfUnknown: boolean): Promise<Row> {
  try {
    return await applyTransfer(ctx, d, await ctx.deriv.getTransferStatus(d.deriv_request_id));
  } catch (e) {
    if (e instanceof DerivApiError && e.code === "RequestIDNotFound" && resendIfUnknown) {
      // Deriv never received it. Re-sending with the SAME request_id is safe: Deriv dedupes on request_id.
      return sendTransfer(ctx, d);
    }
    console.error("[deriv] transfer status check failed", d.deriv_request_id, (e as Error).message);
    return ctx.repo.update("deposits", d.id, { error_message: "Awaiting Deriv confirmation" });
  }
}

/** Re-check a deposit stuck in PROCESSING_DERIV. Safe to call repeatedly. */
export async function reconcileDeposit(ctx: Ctx, d: Row) {
  if (d.status !== "PROCESSING_DERIV") return d;
  return checkTransfer(ctx, d, true);
}