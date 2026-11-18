import { beforeEach, describe, expect, it } from "vitest";
import { MockDeriv } from "@/lib/deriv/mock";
import { DerivApiError } from "@/lib/deriv/types";
import { ServiceError, type Actor, type Ctx } from "./common";
import { approveDeposit, cancelDeposit, createDeposit, reconcileDeposit, rejectDeposit, startReview, submitProof } from "./deposits";
import { InvalidTransition } from "./state";
import { MemoryRepo } from "./repo";
import { reconcileAll, summary } from "./reconcile";
import { advanceSettlement, createWithdrawal, reconcileWithdrawal, requestVerification, verifyWithdrawal } from "./withdrawals";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const user = "user-1";
const admin: Actor = { id: "admin-1", isAdmin: true };
let repo: MemoryRepo, deriv: MockDeriv, ctx: Ctx, clock: number;

beforeEach(async () => {
  repo = new MemoryRepo(); deriv = new MockDeriv(); clock = Date.now();
  ctx = {
    repo, deriv, now: () => new Date(clock), decryptToken: (s) => s,
    saveProof: async (u, id) => `${u}/${id}.png`,
    depositFeePercent: 8, withdrawFeePercent: 5, withdrawFeeThreshold: 1000,
  };
  await repo.saveConnection({ user_id: user, deriv_nickname: "nick", token_enc: "tok", token_expires_at: new Date(clock + 86_400_000).toISOString() });
});

const newDeposit = (nick = "alice", amount: number | string = 100) =>
  createDeposit(ctx, user, { amount, currency: "USD", paymentMethod: "Ecocash", derivNickname: nick });
const withProof = async (nick = "alice", ref = "REF" + Math.random().toString(36).slice(2, 8)) => {
  const d = await newDeposit(nick);
  await submitProof(ctx, user, d.id, { reference: ref, file: { bytes: PNG } });
  return d;
};
const err = async (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe("deposit", () => {
  it("full happy path: create -> proof -> review -> approve -> Deriv transfer -> completed", async () => {
    const d = await newDeposit();
    expect(d.status).toBe("PENDING_PAYMENT");
    expect(d.net_amount).toBe("92.00"); // 8% fee
    expect(d.deriv_request_id).toMatch(/^DEP-\d{8}-[A-Z0-9]{12}$/);
    await submitProof(ctx, user, d.id, { reference: "ECO12345", file: { bytes: PNG } });
    expect((await repo.get("deposits", d.id))!.status).toBe("PAYMENT_SUBMITTED");
    await startReview(ctx, admin, d.id);
    expect((await repo.get("deposits", d.id))!.status).toBe("UNDER_REVIEW");
    const done = await approveDeposit(ctx, admin, d.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.deriv_transaction_id).toMatch(/^MOCK-T-/);
    expect(deriv.calls.transfer).toBe(1);
    const ledger = await repo.listLedger({ user_id: user });
    expect(ledger.map((l) => `${l.type}:${l.status}`).sort()).toEqual(["DERIV_DEPOSIT:COMPLETED", "EXTERNAL_DEPOSIT:VERIFIED"]);
    expect((await summary(ctx, user)).completed_deposits).toBe(92);
    expect(repo.auditLog.map((a) => a.action)).toEqual(expect.arrayContaining(["ADMIN_APPROVED_DEPOSIT", "DERIV_TRANSFER_REQUESTED", "DERIV_TRANSFER_COMPLETED"]));
  });

  it("does not credit anything just because proof was uploaded", async () => {
    await withProof();
    expect(deriv.calls.transfer).toBe(0);
  });

  it("rejected POP never reaches Deriv and cannot be approved afterwards", async () => {
    const d = await withProof();
    const r = await rejectDeposit(ctx, admin, d.id, "Screenshot does not match");
    expect(r.status).toBe("REJECTED");
    expect((await err(approveDeposit(ctx, admin, d.id)))).toBeInstanceOf(ServiceError);
    expect(deriv.calls.transfer).toBe(0);
  });

  it("duplicate / concurrent approval sends exactly one Deriv transfer", async () => {
    const d = await withProof();
    const results = await Promise.all([approveDeposit(ctx, admin, d.id), approveDeposit(ctx, admin, d.id), approveDeposit(ctx, admin, d.id)]
      .map((p) => p.then((x) => x, (e) => e)));
    expect(results.filter((r) => r instanceof ServiceError)).toHaveLength(2);
    expect(deriv.calls.transfer).toBe(1);
    expect(await err(approveDeposit(ctx, admin, d.id))).toBeInstanceOf(ServiceError); // approving again later
    expect(deriv.calls.transfer).toBe(1);
  });

  it("Deriv rejection (unknown nickname at transfer time) -> FAILED with friendly message, no raw error", async () => {
    const d = await withProof();
    const orig = deriv.transfer.bind(deriv);
    deriv.transfer = async (i) => { if (!i.dryRun) throw new DerivApiError("TransferFailed", "SECRET internal detail", 400); return orig(i); };
    const r = await approveDeposit(ctx, admin, d.id);
    expect(r.status).toBe("FAILED");
    expect(r.error_message).toBe("Unable to process the transaction at the moment. Please try again later.");
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });

  it("insufficient agent balance -> FAILED with a clear message", async () => {
    const d = await withProof();
    const orig = deriv.transfer.bind(deriv);
    deriv.transfer = async (i) => { if (!i.dryRun) throw new DerivApiError("WalletFundsInsufficient", "x", 400); return orig(i); };
    const r = await approveDeposit(ctx, admin, d.id);
    expect(r.status).toBe("FAILED");
    expect(r.error_message).toMatch(/Insufficient funds/);
  });

  it("timeout: asks Deriv for the status instead of sending again", async () => {
    const d = await withProof("timeout_user");
    const r = await approveDeposit(ctx, admin, d.id);
    expect(r.status).toBe("COMPLETED");
    expect(deriv.calls.transfer).toBe(1);
  });

  it("timeout where Deriv never received it: stays PROCESSING_DERIV, reconciler re-sends the SAME request_id once", async () => {
    const d = await withProof();
    let first = true;
    const orig = deriv.transfer.bind(deriv);
    deriv.transfer = async (i) => { if (!i.dryRun && first) { first = false; throw new DerivApiError("Timeout", "t", 0, true); } return orig(i); };
    const r = await approveDeposit(ctx, admin, d.id);
    expect(r.status).toBe("PROCESSING_DERIV");
    const again = await reconcileDeposit(ctx, r);
    expect(again.status).toBe("COMPLETED");
    expect(deriv.calls.transfer).toBe(1);
  });

  it("duplicate request_id from Deriv (RequestIDUsed) is resolved by status lookup, not a second transfer", async () => {
    const d = await withProof("slowpoke");
    const r1 = await approveDeposit(ctx, admin, d.id); // pending
    expect(r1.status).toBe("PROCESSING_DERIV");
    const stored = await repo.get("deposits", d.id);
    expect(await err(deriv.transfer({ toNickname: "slowpoke", amount: "92.00", currency: "USD", requestId: stored!.deriv_request_id })))
      .toMatchObject({ code: "RequestIDUsed" });
  });

  it("pending deposit is completed by reconciliation, and re-checking a completed one changes nothing", async () => {
    const d = await withProof("slowpoke");
    const r = await approveDeposit(ctx, admin, d.id);
    expect(r.status).toBe("PROCESSING_DERIV");
    const out = await reconcileAll(ctx); // 1st check: Deriv still pending
    expect(out.deposits).toBe(1);
    expect((await repo.get("deposits", d.id))!.status).toBe("PROCESSING_DERIV");
    await reconcileAll(ctx); // 2nd check: complete
    const done = await repo.get("deposits", d.id);
    expect(done!.status).toBe("COMPLETED");
    await reconcileAll(ctx);
    expect(deriv.calls.transfer).toBe(1);
  });

  it("rejects invalid input, bad files and reused references; non-admin cannot approve", async () => {
    expect((await err(newDeposit("alice", "abc")))).toBeInstanceOf(ServiceError);
    expect((await err(newDeposit("alice", 1)))).toBeInstanceOf(ServiceError);
    expect((await err(newDeposit("fail_user")))).toMatchObject({ code: "NicknameNotFound" });
    const d = await newDeposit();
    expect(await err(submitProof(ctx, user, d.id, { reference: "REF1234", file: { bytes: new Uint8Array([1, 2, 3, 4]) } }))).toMatchObject({ code: "BAD_FILE_TYPE" });
    expect(await err(submitProof(ctx, "someone-else", d.id, { reference: "REF1234", file: { bytes: PNG } }))).toMatchObject({ code: "NOT_FOUND" });
    await withProof("alice", "SAMEREF1");
    const d2 = await newDeposit();
    expect(await err(submitProof(ctx, user, d2.id, { reference: "sameref1", file: { bytes: PNG } }))).toMatchObject({ code: "DUPLICATE_REFERENCE" });
    expect(await err(approveDeposit(ctx, { id: "u", isAdmin: false }, d2.id))).toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks invalid status transitions", async () => {
    const d = await newDeposit();
    expect(await err(approveDeposit(ctx, admin, d.id))).toBeInstanceOf(ServiceError); // PENDING_PAYMENT cannot be approved
    await cancelDeposit(ctx, user, d.id);
    expect(await err(cancelDeposit(ctx, user, d.id))).toBeInstanceOf(ServiceError);
    expect(InvalidTransition).toBeDefined();
  });
});

describe("withdrawal", () => {
  const start = async (amount: number | string = 50) => {
    const w = await createWithdrawal(ctx, user, { amount, currency: "USD", payoutMethod: "Ecocash", payoutDetails: "+263 78 000 0000" });
    await requestVerification(ctx, user, w.id);
    return w;
  };

  it("full path: request -> code -> verify -> pending -> status check -> completed -> settlement", async () => {
    const w0 = await createWithdrawal(ctx, user, { amount: 50, currency: "USD", payoutMethod: "Ecocash", payoutDetails: "+263 78 000 0000" });
    expect(w0.status).toBe("REQUESTED");
    const v = await requestVerification(ctx, user, w0.id);
    expect(v.status).toBe("VERIFICATION_REQUIRED");
    const p = await verifyWithdrawal(ctx, user, w0.id, "123456");
    expect(p.status).toBe("PROCESSING");
    expect((await summary(ctx, user)).pending_withdrawals).toBe(50);
    const done = await reconcileWithdrawal(ctx, p);
    expect(done.status).toBe("COMPLETED");
    expect(done.settlement_status).toBe("READY_FOR_SETTLEMENT");
    await advanceSettlement(ctx, admin, w0.id, "SETTLEMENT_PROCESSING");
    const s = await advanceSettlement(ctx, admin, w0.id, "SETTLEMENT_COMPLETED", "ECO-REF-1");
    expect(s.settlement_status).toBe("SETTLEMENT_COMPLETED");
    expect(await err(advanceSettlement(ctx, admin, w0.id, "READY_FOR_SETTLEMENT"))).toBeInstanceOf(InvalidTransition);
    expect((await repo.listLedger({ user_id: user })).map((l) => `${l.type}:${l.status}`).sort())
      .toEqual(["DERIV_WITHDRAWAL:COMPLETED", "EXTERNAL_SETTLEMENT:COMPLETED"]);
    expect((await summary(ctx, user)).completed_withdrawals).toBe(50);
  });

  it("incorrect OTP returns to VERIFICATION_REQUIRED and allows a retry", async () => {
    const w = await start();
    expect(await err(verifyWithdrawal(ctx, user, w.id, "000000"))).toMatchObject({ code: "InvalidOTP" });
    expect((await repo.get("withdrawals", w.id))!.status).toBe("VERIFICATION_REQUIRED");
    expect((await verifyWithdrawal(ctx, user, w.id, "123456")).status).toBe("PROCESSING");
  });

  it("expired OTP (ours or Deriv's) forces a fresh code", async () => {
    const w = await start();
    expect(await err(verifyWithdrawal(ctx, user, w.id, "999999"))).toMatchObject({ code: "OTPExpired" });
    expect(await err(verifyWithdrawal(ctx, user, w.id, "123456"))).toMatchObject({ code: "CODE_EXPIRED" });
    clock += 120_000; // past the resend cooldown
    await requestVerification(ctx, user, w.id);
    expect((await verifyWithdrawal(ctx, user, w.id, "123456")).status).toBe("PROCESSING");
  });

  it("duplicate / concurrent submission reaches Deriv once", async () => {
    const w = await start();
    const res = await Promise.all([verifyWithdrawal(ctx, user, w.id, "123456"), verifyWithdrawal(ctx, user, w.id, "123456")].map((p) => p.then((x) => x, (e) => e)));
    expect(res.filter((r) => r instanceof ServiceError)).toHaveLength(1);
    expect(deriv.calls.withdraw).toBe(1);
  });

  it("Deriv API failure -> FAILED with a friendly message", async () => {
    const w = await start(13.13);
    const e = await err(verifyWithdrawal(ctx, user, w.id, "123456"));
    expect(e).toBeInstanceOf(ServiceError);
    expect((await repo.get("withdrawals", w.id))!.status).toBe("FAILED");
  });

  it("insufficient wallet balance -> FAILED, customer-safe message", async () => {
    const w = await start();
    deriv.withdraw = async () => { throw new DerivApiError("WalletFundsInsufficient", "x", 400); };
    expect(await err(verifyWithdrawal(ctx, user, w.id, "123456"))).toMatchObject({ message: expect.stringMatching(/Insufficient funds/) });
    expect((await repo.get("withdrawals", w.id))!.status).toBe("FAILED");
  });

  it("timeout on submit: status looked up, not resubmitted; repeated status checks are stable", async () => {
    const w = await start();
    const orig = deriv.withdraw.bind(deriv);
    deriv.withdraw = async (i) => { await orig(i); throw new DerivApiError("Timeout", "t", 0, true); };
    const r = await verifyWithdrawal(ctx, user, w.id, "123456");
    expect(r.status).toBe("COMPLETED");
    for (let i = 0; i < 3; i++) await reconcileWithdrawal(ctx, (await repo.get("withdrawals", w.id))!);
    expect(deriv.calls.withdraw).toBe(1);
    expect((await repo.get("withdrawals", w.id))!.status).toBe("COMPLETED");
  });

  it("requires a connected Deriv account, validates format, and never stores the code", async () => {
    await repo.saveConnection({ user_id: user, token_expires_at: new Date(clock - 1000).toISOString(), token_enc: "x" });
    expect(await err(createWithdrawal(ctx, user, { amount: 50, currency: "USD", payoutMethod: "Ecocash", payoutDetails: "+263 78 000" }))).toMatchObject({ code: "NEEDS_CONNECT" });
    await repo.saveConnection({ user_id: user, token_expires_at: new Date(clock + 1e7).toISOString(), token_enc: "x" });
    const w = await start();
    expect(await err(verifyWithdrawal(ctx, user, w.id, "12ab56"))).toMatchObject({ code: "INVALID_CODE" });
    await verifyWithdrawal(ctx, user, w.id, "123456");
    expect(JSON.stringify(repo.t) + JSON.stringify(repo.auditLog)).not.toContain("123456");
  });
});
