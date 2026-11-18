import { DerivApiError, type DerivProvider, type TransferResult, type WithdrawResult } from "./types";

/**
 * Development stand-in for Deriv (DERIV_MOCK_MODE=true). Behaviour is driven by magic values:
 *
 * Deposit (by nickname):   "fail*" -> rejected (NicknameNotFound) | "broke*" -> WalletFundsInsufficient
 *                          "slow*" -> returns pending, completes on 2nd status check
 *                          "timeout*" -> first call times out (uncertain), but the transfer DID happen
 *                          anything else -> complete immediately
 * Withdrawal code:         "123456" ok | "000000" InvalidOTP | "999999" expired
 * Withdrawal amount:       13.13 -> API failure | 7.77 -> stays pending for 1 status check
 */
export class MockDeriv implements DerivProvider {
  private transfers = new Map<string, { nickname: string; checks: number; done: boolean }>();
  private withdrawals = new Map<string, { checks: number; slow: boolean }>();
  private n = 1000;
  calls = { transfer: 0, withdraw: 0 };

  async transfer(i: Parameters<DerivProvider["transfer"]>[0]): Promise<TransferResult> {
    const nick = i.toNickname.toLowerCase();
    if (nick.startsWith("fail")) throw new DerivApiError("NicknameNotFound", "Nickname not found", 400);
    if (nick.startsWith("broke")) throw new DerivApiError("WalletFundsInsufficient", "Agent wallet empty", 400);
    if (i.dryRun) return { status: "dry_run_ok", transactionId: null };
    if (this.transfers.has(i.requestId)) throw new DerivApiError("RequestIDUsed", "The request_id has already been used", 400);
    this.calls.transfer++;
    this.transfers.set(i.requestId, { nickname: nick, checks: 0, done: !nick.startsWith("slow") });
    if (nick.startsWith("timeout")) throw new DerivApiError("Timeout", "timeout", 0, true);
    return nick.startsWith("slow") ? { status: "pending", transactionId: null } : { status: "complete", transactionId: `MOCK-T-${++this.n}` };
  }

  async getTransferStatus(requestId: string): Promise<TransferResult> {
    const t = this.transfers.get(requestId);
    if (!t) throw new DerivApiError("RequestIDNotFound", "not found", 400);
    t.checks++;
    if (t.nickname.startsWith("slow") && t.checks < 2) return { status: "pending", transactionId: null };
    return { status: "complete", transactionId: `MOCK-T-${requestId.slice(-6)}` };
  }

  async requestWithdrawalCode(): Promise<{ expiresAt: number; nextRequestAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    return { expiresAt: now + 600, nextRequestAt: now + 60 };
  }

  async withdraw(i: Parameters<DerivProvider["withdraw"]>[0]): Promise<WithdrawResult> {
    if (i.verificationCode === "000000") throw new DerivApiError("InvalidOTP", "Invalid OTP", 400);
    if (i.verificationCode === "999999") throw new DerivApiError("OTPExpired", "Code expired", 400);
    if (Number(i.amount) === 13.13) throw new DerivApiError("WithdrawalFailed", "boom", 500);
    if (this.withdrawals.has(i.requestId)) throw new DerivApiError("RequestIDUsed", "used", 400);
    this.calls.withdraw++;
    this.withdrawals.set(i.requestId, { checks: 0, slow: Number(i.amount) === 7.77 });
    return { status: "pending", transactionId: null };
  }

  async getWithdrawalStatus(requestId: string): Promise<WithdrawResult> {
    const w = this.withdrawals.get(requestId);
    if (!w) throw new DerivApiError("RequestIDNotFound", "not found", 400);
    w.checks++;
    if (w.slow && w.checks < 2) return { status: "pending", transactionId: null };
    return { status: "complete", transactionId: `MOCK-W-${requestId.slice(-6)}` };
  }

  buildAuthorizeUrl({ state }: { state: string }) {
    return `/api/deriv/oauth/callback?code=mock-code&state=${encodeURIComponent(state)}`;
  }
  async exchangeCode() {
    return { accessToken: "mock-access-token", expiresIn: 2_592_000 };
  }
}
