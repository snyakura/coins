import { DerivApiError, type DerivEnvelope, type DerivProvider, type TransferResult, type WithdrawResult } from "./types";
import type { DerivConfig } from "./config";

const TIMEOUT_MS = 15_000;

/** Real Deriv REST client. Secrets are read from config and never logged. */
export class DerivClient implements DerivProvider {
  constructor(private cfg: DerivConfig, private fetchImpl: typeof fetch = fetch) {}

  private async call<T>(method: "GET" | "POST", path: string, token: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.apiBaseUrl}${path}`, {
        method,
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Deriv-App-ID": this.cfg.appId,
          Authorization: `Bearer ${token}`,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      const timeout = (e as Error)?.name === "AbortError";
      throw new DerivApiError(timeout ? "Timeout" : "NetworkError", timeout ? "Deriv request timed out" : "Deriv unreachable", 0, true);
    } finally {
      clearTimeout(timer);
    }
    let json: DerivEnvelope<T> | null = null;
    try { json = (await res.json()) as DerivEnvelope<T>; } catch { /* non-JSON error page */ }
    if (!res.ok || json?.errors?.length) {
      const err = json?.errors?.[0];
      throw new DerivApiError(
        err?.code ?? `HTTP_${res.status}`,
        err?.detail?.message ?? `Deriv returned HTTP ${res.status}`,
        res.status,
        res.status >= 500, // 5xx / 504: outcome unknown
        err?.detail?.next_request_at,
      );
    }
    return (json?.data ?? ({} as T)) as T;
  }

  // Response field names (status, transaction_id, expires_at, next_request_at) are from the Deriv docs.
  private mapTransfer(d: any): TransferResult {
    return { status: String(d?.status ?? "pending") as TransferResult["status"], transactionId: d?.transaction_id != null ? String(d.transaction_id) : null };
  }
  private mapWithdraw(d: any): WithdrawResult {
    return { status: String(d?.status ?? "pending") as WithdrawResult["status"], transactionId: d?.transaction_id != null ? String(d.transaction_id) : null };
  }

  async transfer(i: Parameters<DerivProvider["transfer"]>[0]) {
    const d = await this.call<any>("POST", "/payment-agents/v1/transfer", this.cfg.agentToken, {
      data: { to_nickname: i.toNickname, amount: i.amount, currency: i.currency, request_id: i.requestId,
              ...(i.notes ? { notes: i.notes } : {}), ...(i.dryRun ? { dry_run: true } : {}) },
    });
    return this.mapTransfer(d);
  }

  async getTransferStatus(requestId: string) {
    return this.mapTransfer(await this.call<any>("GET", `/payment-agents/v1/transfer/${encodeURIComponent(requestId)}`, this.cfg.agentToken));
  }

  async requestWithdrawalCode(a: { clientToken: string; amount: string; currency: string }) {
    const d = await this.call<any>("POST", "/payment-agents/v1/withdraw/verification_code", a.clientToken, {
      data: { agent_id: this.cfg.agentId, amount: a.amount, currency: a.currency },
    });
    return { expiresAt: Number(d?.expires_at ?? 0), nextRequestAt: Number(d?.next_request_at ?? 0) };
  }

  async withdraw(i: Parameters<DerivProvider["withdraw"]>[0]) {
    const d = await this.call<any>("POST", "/payment-agents/v1/withdraw", i.clientToken, {
      data: { agent_id: this.cfg.agentId, amount: i.amount, currency: i.currency, verification_code: i.verificationCode,
              request_id: i.requestId, ...(i.notes ? { notes: i.notes } : {}) },
    });
    return this.mapWithdraw(d);
  }

  /** Docs: both the client and the agent may query withdrawal status, so the agent token is used for reconciliation. */
  async getWithdrawalStatus(requestId: string) {
    return this.mapWithdraw(await this.call<any>("GET", `/payment-agents/v1/withdraw/${encodeURIComponent(requestId)}`, this.cfg.agentToken));
  }

  buildAuthorizeUrl({ state, codeChallenge }: { state: string; codeChallenge: string }) {
    const q = new URLSearchParams({
      response_type: "code", client_id: this.cfg.clientId, redirect_uri: this.cfg.redirectUri,
      scope: "payment", state, code_challenge: codeChallenge, code_challenge_method: "S256",
    });
    return `${this.cfg.authBaseUrl}/oauth2/auth?${q}`;
  }

  async exchangeCode({ code, codeVerifier }: { code: string; codeVerifier: string }) {
    const res = await this.fetchImpl(`${this.cfg.authBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: this.cfg.clientId, code, code_verifier: codeVerifier, redirect_uri: this.cfg.redirectUri }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new DerivApiError(String(j.error ?? "OAuthExchangeFailed"), "OAuth token exchange failed", res.status);
    return { accessToken: String(j.access_token), expiresIn: Number(j.expires_in ?? 0) };
  }
}
