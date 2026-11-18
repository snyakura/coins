// Request/response shapes follow https://developers.deriv.com/docs/payment-agents/ (checked 2026-11-17).
// If Deriv renames a field, change it HERE (and in client.ts mappers) only.

export type DerivEnvelope<T> = {
  data: T;
  errors?: { status: number; code: string; detail?: { message?: string; next_request_at?: number } }[];
  metadata?: unknown;
};

export type TransferStatus = "complete" | "pending" | "dry_run_ok" | "rejected" | "failed";
export type WithdrawStatus = "requested" | "pending" | "complete" | "rejected" | "failed";

export type TransferResult = { status: TransferStatus; transactionId: string | null };
export type WithdrawResult = { status: WithdrawStatus; transactionId: string | null };
export type VerificationResult = { expiresAt: number; nextRequestAt: number }; // epoch seconds

export type TransferInput = {
  toNickname: string;
  amount: string; // decimal string, e.g. "100.00"
  currency: string;
  requestId: string;
  notes?: string;
  dryRun?: boolean;
};

export type WithdrawInput = {
  clientToken: string;
  amount: string;
  currency: string;
  verificationCode: string;
  requestId: string;
  notes?: string;
};

/** Everything the app needs from Deriv. Implemented by the real client and by the mock. */
export interface DerivProvider {
  transfer(i: TransferInput): Promise<TransferResult>;
  getTransferStatus(requestId: string): Promise<TransferResult>;
  requestWithdrawalCode(a: { clientToken: string; amount: string; currency: string }): Promise<VerificationResult>;
  withdraw(i: WithdrawInput): Promise<WithdrawResult>;
  getWithdrawalStatus(requestId: string): Promise<WithdrawResult>;
  /** OAuth (Authorization Code + PKCE, public client: no client secret, no refresh token). */
  buildAuthorizeUrl(a: { state: string; codeChallenge: string }): string;
  exchangeCode(a: { code: string; codeVerifier: string }): Promise<{ accessToken: string; expiresIn: number }>;
}

export class DerivApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 0,
    /** true when we cannot know whether Deriv acted (timeout, network, 5xx). Never blind-retry these. */
    public readonly uncertain = false,
    public readonly nextRequestAt?: number,
  ) {
    super(message);
    this.name = "DerivApiError";
  }
}
