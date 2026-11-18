export const DEPOSIT_STATUSES = ["PENDING_PAYMENT","PAYMENT_SUBMITTED","UNDER_REVIEW","PAYMENT_VERIFIED","PROCESSING_DERIV","COMPLETED","FAILED","REJECTED","CANCELLED"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];
export const WITHDRAWAL_STATUSES = ["REQUESTED","VERIFICATION_REQUIRED","VERIFIED","PROCESSING","COMPLETED","FAILED","REJECTED","CANCELLED"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];
export type SettlementStatus = "NONE" | "READY_FOR_SETTLEMENT" | "SETTLEMENT_PROCESSING" | "SETTLEMENT_COMPLETED";

export const DEPOSIT_TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_SUBMITTED", "CANCELLED"],
  PAYMENT_SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["PAYMENT_VERIFIED", "REJECTED"],
  PAYMENT_VERIFIED: ["PROCESSING_DERIV"],
  PROCESSING_DERIV: ["COMPLETED", "FAILED"],
  COMPLETED: [], FAILED: [], REJECTED: [], CANCELLED: [],
};

export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  REQUESTED: ["VERIFICATION_REQUIRED", "FAILED", "CANCELLED"],
  VERIFICATION_REQUIRED: ["VERIFIED", "CANCELLED", "FAILED"],
  VERIFIED: ["PROCESSING", "COMPLETED", "VERIFICATION_REQUIRED", "FAILED", "REJECTED"],
  PROCESSING: ["COMPLETED", "FAILED", "REJECTED"],
  COMPLETED: [], FAILED: [], REJECTED: [], CANCELLED: [],
};

export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  NONE: ["READY_FOR_SETTLEMENT"],
  READY_FOR_SETTLEMENT: ["SETTLEMENT_PROCESSING"],
  SETTLEMENT_PROCESSING: ["SETTLEMENT_COMPLETED"],
  SETTLEMENT_COMPLETED: [],
};

export class InvalidTransition extends Error {
  constructor(public from: string, public to: string) { super(`Invalid transition ${from} -> ${to}`); this.name = "InvalidTransition"; }
}
export function assertTransition<S extends string>(map: Record<S, S[]>, from: S, to: S) {
  if (!map[from]?.includes(to)) throw new InvalidTransition(from, to);
}
