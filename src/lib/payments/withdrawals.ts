import { friendlyMessage, isDefiniteRejection, needsReconnect } from "@/lib/deriv/errors";
import { DerivApiError, type WithdrawResult } from "@/lib/deriv/types";
import {
  type Actor, type Ctx, ServiceError, dayStamp, fromCents, parseAmount, parseCurrency, randomId, toCents,
} from "./common";
import type { Row } from "./repo";
import { SETTLEMENT_TRANSITIONS, WITHDRAWAL_TRANSITIONS, assertTransition, type SettlementStatus, type WithdrawalStatus } from "./state";

const PAYOUT_METHODS = ["Ecocash", "InnBucks", "FNB BUSINESS ACCOUNT", "USDT"] as const;
const MIN_WITHDRAW = 5;

async function audit(ctx: Ctx, action: string, w: Row, from: string | null, to: string | null, adminId?: string, note?: string) {
  await ctx.repo.audit({ action, user_id: w.user_id, admin_id: adminId ?? null, entity: "withdrawal", entity_id: w.id,
    previous_status: from, new_status: to, provider_ref: w.deriv_transaction_id ?? w.deriv_request_id, note: note ?? null });
}

async function move(ctx: Ctx, id: string, from: WithdrawalStatus | WithdrawalStatus[], to: WithdrawalStatus, patch: Row = {}, msg = "This withdrawal has already been processed.") {
  for (const f of ([] as WithdrawalStatus[]).concat(from)) assertTransition(WITHDRAWAL_TRANSITIONS, f, to);
  const row = await ctx.repo.cas("withdrawals", id, from, { ...patch, status: to });
  if (!row) throw new ServiceError(409, msg, "ALREADY_PROCESSED");
  return row;
}

async function clientToken(ctx: Ctx, userId: string): Promise<string> {
  const c = await ctx.repo.getConnection(userId);
  if (!c || new Date(c.token_expires_at).getTime() <= ctx.now().getTime())
    throw new ServiceError(409, "Please connect your Deriv account to continue.", "NEEDS_CONNECT");
  return ctx.decryptToken(c.token_enc);
}

export async function createWithdrawal(ctx: Ctx, userId: string, input: { amount: unknown; currency: unknown; payoutMethod: unknown; payoutDetails: unknown }) {
  const amount = parseAmount(input.amount);
  const currency = parseCurrency(input.currency);
  if (amount < MIN_WITHDRAW) throw new ServiceError(400, `The minimum withdrawal is $${MIN_WITHDRAW}.`, "AMOUNT_RANGE");
  if (typeof input.payoutMethod !== "string" || !(PAYOUT_METHODS as readonly string[]).includes(input.payoutMethod))
    throw new ServiceError(400, "Please choose how you'd like to be paid.", "INVALID_METHOD");
  const details = typeof input.payoutDetails === "string" ? input.payoutDetails.trim() : "";
  if (details.length < 4 || details.length > 200) throw new ServiceError(400, "Please enter your payout details.", "INVALID_PAYOUT");
  await clientToken(ctx, userId); // must be connected before we start

  const gross = toCents(amount);
  const fee = amount >= ctx.withdrawFeeThreshold ? Math.round(gross * (ctx.withdrawFeePercent / 100)) : 0;
  const requestId = `WDR-${dayStamp(ctx.now())}-${randomId()}`;
  const w = await ctx.repo.insert("withdrawals", {
    user_id: userId, amount: fromCents(gross), fee: fromCents(fee), net_payout: fromCents(gross - fee), currency,
    status: "REQUESTED", settlement_status: "NONE", deriv_request_id: requestId, payout_method: input.payoutMethod,
    payout_details: details, otp_attempts: 0,
  });
  await ctx.repo.upsertLedger({
    user_id: userId, type: "DERIV_WITHDRAWAL", direction: "IN", amount: fromCents(gross), currency, status: "PENDING",
    provider: "deriv", provider_request_id: requestId, payment_method: input.payoutMethod, metadata: { withdrawal_id: w.id },
  });
  await audit(ctx, "WITHDRAWAL_REQUESTED", w, null, "REQUESTED");
  return w;
}

export async function getWithdrawal(ctx: Ctx, actor: Actor, id: string) {
  const w = await ctx.repo.get("withdrawals", id);
  if (!w || (w.user_id !== actor.id && !actor.isAdmin)) throw new ServiceError(404, "Withdrawal not found.", "NOT_FOUND");
  return w;
}

export async function requestVerification(ctx: Ctx, userId: string, id: string) {
  const w = await ctx.repo.get("withdrawals", id);
  if (!w || w.user_id !== userId) throw new ServiceError(404, "Withdrawal not found.", "NOT_FOUND");
  if (w.next_code_at && new Date(w.next_code_at).getTime() > ctx.now().getTime())
    throw new ServiceError(429, "Please wait a moment before requesting another code.", "CODE_COOLDOWN");
  const token = await clientToken(ctx, userId);
  try {
    const r = await ctx.deriv.requestWithdrawalCode({ clientToken: token, amount: Number(w.amount).toFixed(2), currency: w.currency });
    const patch = {
      code_expires_at: new Date(r.expiresAt * 1000).toISOString(), next_code_at: new Date(r.nextRequestAt * 1000).toISOString(),
      otp_attempts: 0, error_message: null,
    };
    const row = w.status === "REQUESTED"
      ? await move(ctx, id, "REQUESTED", "VERIFICATION_REQUIRED", patch)
      : (await ctx.repo.cas("withdrawals", id, "VERIFICATION_REQUIRED", { ...patch, status: "VERIFICATION_REQUIRED" }))
        ?? (() => { throw new ServiceError(409, "This withdrawal can no longer be verified.", "ALREADY_PROCESSED"); })();
    await audit(ctx, "VERIFICATION_CODE_REQUESTED", row, w.status, "VERIFICATION_REQUIRED");
    return row;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    console.error("[deriv] verification code request failed", w.deriv_request_id, (e as Error).message);
    if (needsReconnect(e)) throw new ServiceError(409, "Please reconnect your Deriv account.", "NEEDS_CONNECT");
    const status = e instanceof DerivApiError && e.code === "OtpRateLimitExceeded" ? 429 : 400;
    throw new ServiceError(status, friendlyMessage(e), e instanceof DerivApiError ? e.code : "ERROR");
  }
}

/** The 6-digit code is passed straight to Deriv and is never stored or logged. */
export async function verifyWithdrawal(ctx: Ctx, userId: string, id: string, code: unknown) {
  if (typeof code !== "string" || !/^[0-9]{6}$/.test(code)) throw new ServiceError(400, "Enter the 6-digit code.", "INVALID_CODE");
  const w = await ctx.repo.get("withdrawals", id);
  if (!w || w.user_id !== userId) throw new ServiceError(404, "Withdrawal not found.", "NOT_FOUND");
  if (w.status !== "VERIFICATION_REQUIRED") throw new ServiceError(409, "This withdrawal has already been submitted.", "ALREADY_PROCESSED");
  if (!w.code_expires_at || new Date(w.code_expires_at).getTime() <= ctx.now().getTime())
    throw new ServiceError(400, "That verification code has expired. Please request a new one.", "CODE_EXPIRED");
  const token = await clientToken(ctx, userId);

  // Lock: only one concurrent submit can move VERIFICATION_REQUIRED -> VERIFIED and reach Deriv.
  const locked = await move(ctx, id, "VERIFICATION_REQUIRED", "VERIFIED", {}, "This withdrawal has already been submitted.");
  try {
    const r = await ctx.deriv.withdraw({ clientToken: token, amount: Number(locked.amount).toFixed(2), currency: locked.currency, verificationCode: code, requestId: locked.deriv_request_id });
    await audit(ctx, "WITHDRAWAL_SUBMITTED", locked, "VERIFIED", "PROCESSING");
    return applyWithdraw(ctx, locked, r);
  } catch (e) {
    const code_ = e instanceof DerivApiError ? e.code : "UNKNOWN";
    console.error("[deriv] withdraw error", locked.deriv_request_id, code_, (e as Error).message);
    if (e instanceof DerivApiError && (code_ === "InvalidOTP" || code_ === "OTPExpired" || code_ === "OTPValidationFailed" || code_ === "VerificationCodeFormatInvalid")) {
      const attempts = Number(locked.otp_attempts ?? 0) + 1;
      const expired = code_ !== "InvalidOTP" || attempts >= 5;
      await ctx.repo.cas("withdrawals", id, "VERIFIED", {
        status: "VERIFICATION_REQUIRED", otp_attempts: attempts, ...(expired ? { code_expires_at: ctx.now().toISOString() } : {}),
        error_message: friendlyMessage(e),
      });
      throw new ServiceError(400, expired && code_ === "InvalidOTP" ? "Too many incorrect codes. Please request a new one." : friendlyMessage(e), code_);
    }
    if (needsReconnect(e)) {
      await ctx.repo.cas("withdrawals", id, "VERIFIED", { status: "VERIFICATION_REQUIRED", code_expires_at: ctx.now().toISOString() });
      throw new ServiceError(409, "Please reconnect your Deriv account.", "NEEDS_CONNECT");
    }
    if (e instanceof DerivApiError && (e.uncertain || code_ === "RequestIDUsed")) {
      const row = await checkWithdrawal(ctx, locked); // ask Deriv, never resubmit
      return row;
    }
    if (isDefiniteRejection(e)) {
      const row = (await ctx.repo.cas("withdrawals", id, "VERIFIED", { status: "FAILED", deriv_status: "failed", error_message: friendlyMessage(e) })) ?? locked;
      await ctx.repo.updateLedger("DERIV_WITHDRAWAL", locked.deriv_request_id, { status: "FAILED", metadata: { withdrawal_id: id, error_code: code_ } });
      await audit(ctx, "WITHDRAWAL_FAILED", row, "VERIFIED", "FAILED", undefined, code_);
      throw new ServiceError(400, friendlyMessage(e), code_);
    }
    const row = (await ctx.repo.cas("withdrawals", id, "VERIFIED", { status: "FAILED", deriv_status: "failed", error_message: "Unable to process" })) ?? locked;
    await audit(ctx, "WITHDRAWAL_FAILED", row, "VERIFIED", "FAILED", undefined, code_);
    throw new ServiceError(500, friendlyMessage(e), "ERROR");
  }
}

async function applyWithdraw(ctx: Ctx, w: Row, r: WithdrawResult): Promise<Row> {
  const from = ["VERIFIED", "PROCESSING"];
  if (r.status === "complete") {
    const row = (await ctx.repo.cas("withdrawals", w.id, from, {
      status: "COMPLETED", deriv_status: "complete", deriv_transaction_id: r.transactionId, settlement_status: "READY_FOR_SETTLEMENT", error_message: null,
    })) ?? (await ctx.repo.get("withdrawals", w.id))!;
    await ctx.repo.updateLedger("DERIV_WITHDRAWAL", w.deriv_request_id, { status: "COMPLETED", provider_transaction_id: r.transactionId });
    await ctx.repo.upsertLedger({
      user_id: w.user_id, type: "EXTERNAL_SETTLEMENT", direction: "OUT", amount: w.net_payout, currency: w.currency, status: "PENDING",
      provider: "external", provider_request_id: w.deriv_request_id, payment_method: w.payout_method, metadata: { withdrawal_id: w.id },
    });
    await audit(ctx, "WITHDRAWAL_COMPLETED", row, w.status, "COMPLETED");
    return row;
  }
  if (r.status === "rejected" || r.status === "failed") {
    const to = r.status === "rejected" ? "REJECTED" : "FAILED";
    const row = (await ctx.repo.cas("withdrawals", w.id, from, { status: to, deriv_status: r.status })) ?? w;
    await ctx.repo.updateLedger("DERIV_WITHDRAWAL", w.deriv_request_id, { status: to });
    await audit(ctx, "WITHDRAWAL_FAILED", row, w.status, to);
    return row;
  }
  return (await ctx.repo.cas("withdrawals", w.id, from, { status: "PROCESSING", deriv_status: String(r.status), error_message: null })) ?? w;
}

async function checkWithdrawal(ctx: Ctx, w: Row): Promise<Row> {
  try {
    return await applyWithdraw(ctx, w, await ctx.deriv.getWithdrawalStatus(w.deriv_request_id));
  } catch (e) {
    if (e instanceof DerivApiError && e.code === "RequestIDNotFound" && w.status === "VERIFIED") {
      // Deriv never saw it and the one-time code may be spent: customer needs a fresh code.
      return (await ctx.repo.cas("withdrawals", w.id, "VERIFIED", { status: "VERIFICATION_REQUIRED", code_expires_at: ctx.now().toISOString() })) ?? w;
    }
    console.error("[deriv] withdrawal status check failed", w.deriv_request_id, (e as Error).message);
    return w;
  }
}

export async function reconcileWithdrawal(ctx: Ctx, w: Row) {
  if (w.status !== "VERIFIED" && w.status !== "PROCESSING") return w;
  return checkWithdrawal(ctx, w);
}

export async function cancelWithdrawal(ctx: Ctx, userId: string, id: string) {
  const w = await ctx.repo.get("withdrawals", id);
  if (!w || w.user_id !== userId) throw new ServiceError(404, "Withdrawal not found.", "NOT_FOUND");
  const row = await move(ctx, id, ["REQUESTED", "VERIFICATION_REQUIRED"], "CANCELLED");
  await ctx.repo.updateLedger("DERIV_WITHDRAWAL", w.deriv_request_id, { status: "CANCELLED" });
  await audit(ctx, "WITHDRAWAL_CANCELLED", row, w.status, "CANCELLED");
  return row;
}

/** Admin: external settlement with the customer, kept separate from the Deriv transaction. */
export async function advanceSettlement(ctx: Ctx, admin: Actor, id: string, to: SettlementStatus, reference?: string) {
  if (!admin.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN");
  const w = await ctx.repo.get("withdrawals", id);
  if (!w) throw new ServiceError(404, "Withdrawal not found.", "NOT_FOUND");
  if (w.status !== "COMPLETED") throw new ServiceError(409, "Deriv has not confirmed this withdrawal yet.", "NOT_READY");
  assertTransition(SETTLEMENT_TRANSITIONS, w.settlement_status, to);
  const row = await ctx.repo.update("withdrawals", id, { settlement_status: to, ...(reference ? { external_reference: reference.slice(0, 128) } : {}) });
  await ctx.repo.updateLedger("EXTERNAL_SETTLEMENT", w.deriv_request_id, {
    status: to === "SETTLEMENT_COMPLETED" ? "COMPLETED" : "PROCESSING", ...(reference ? { external_reference: reference.slice(0, 128) } : {}),
  });
  await audit(ctx, to === "SETTLEMENT_COMPLETED" ? "EXTERNAL_SETTLEMENT_COMPLETED" : "SETTLEMENT_STATUS_CHANGED", row, w.settlement_status, to, admin.id);
  return row;
}
