import type { DerivProvider } from "@/lib/deriv/types";
import type { Repo } from "./repo";

export class ServiceError extends Error {
  /** `message` is always customer-safe. Technical detail goes in `detail` and is logged server-side only. */
  constructor(public status: number, message: string, public code = "ERROR", public detail?: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export type Actor = { id: string; isAdmin: boolean };
export type ProofFile = { bytes: Uint8Array; name: string };
export type Ctx = {
  repo: Repo;
  deriv: DerivProvider;
  /** Stores a proof file privately and returns its storage path. */
  saveProof: (userId: string, depositId: string, file: { bytes: Uint8Array; mime: string; ext: string }) => Promise<string>;
  decryptToken: (blob: string) => string;
  now: () => Date;
  depositFeePercent: number;
  withdrawFeePercent: number;
  withdrawFeeThreshold: number;
};

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);
export const dayStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
export const randomId = () => globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

export const METHODS = ["Ecocash", "InnBucks", "FNB BUSINESS ACCOUNT"] as const;
export const CURRENCIES = ["USD"] as const;
export const MIN_AMOUNT = 5;
export const MAX_DEPOSIT = 2000;

export function parseAmount(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : (raw as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6)
    throw new ServiceError(400, "Please enter a valid amount (up to 2 decimal places).", "INVALID_AMOUNT");
  return n;
}
export function parseCurrency(raw: unknown): string {
  if (typeof raw !== "string" || !(CURRENCIES as readonly string[]).includes(raw))
    throw new ServiceError(400, "This currency isn't supported.", "INVALID_CURRENCY");
  return raw;
}

export const config = (env: Record<string, string | undefined> = process.env) => ({
  depositFeePercent: Number(env.DEPOSIT_FEE_PERCENT ?? 8),
  withdrawFeePercent: Number(env.WITHDRAW_FEE_PERCENT ?? 5),
  withdrawFeeThreshold: Number(env.WITHDRAW_FEE_THRESHOLD ?? 1000),
});
