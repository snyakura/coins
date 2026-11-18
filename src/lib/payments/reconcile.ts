import type { Ctx } from "./common";
import { reconcileDeposit } from "./deposits";
import { reconcileWithdrawal } from "./withdrawals";

/** Re-checks everything stuck in flight. Idempotent: it only ever READS Deriv status (or re-sends the same request_id). */
export async function reconcileAll(ctx: Ctx) {
  const deposits = await ctx.repo.list("deposits", { status: "PROCESSING_DERIV" }, 100);
  const withdrawals = await ctx.repo.list("withdrawals", { status: ["VERIFIED", "PROCESSING"] }, 100);
  let touched = 0;
  for (const d of deposits) { try { await reconcileDeposit(ctx, d); touched++; } catch (e) { console.error("[reconcile] deposit", d.id, (e as Error).message); } }
  for (const w of withdrawals) { try { await reconcileWithdrawal(ctx, w); touched++; } catch (e) { console.error("[reconcile] withdrawal", w.id, (e as Error).message); } }
  return { deposits: deposits.length, withdrawals: withdrawals.length, touched };
}

/** What the platform owes / is waiting on for one customer. Funds live in Deriv, so the ledger is the internal source of truth. */
export async function summary(ctx: Ctx, userId: string) {
  const sum = (rows: { amount?: string; net_amount?: string }[], k: "amount" | "net_amount") => rows.reduce((a, r) => a + Math.round(Number(r[k]) * 100), 0) / 100;
  const deps = await ctx.repo.list("deposits", { user_id: userId }, 500);
  const wds = await ctx.repo.list("withdrawals", { user_id: userId }, 500);
  return {
    pending_deposits: sum(deps.filter((d) => ["PENDING_PAYMENT","PAYMENT_SUBMITTED","UNDER_REVIEW","PAYMENT_VERIFIED","PROCESSING_DERIV"].includes(d.status)), "net_amount"),
    completed_deposits: sum(deps.filter((d) => d.status === "COMPLETED"), "net_amount"),
    pending_withdrawals: sum(wds.filter((w) => ["REQUESTED","VERIFICATION_REQUIRED","VERIFIED","PROCESSING"].includes(w.status)), "amount"),
    completed_withdrawals: sum(wds.filter((w) => w.status === "COMPLETED"), "amount"),
  };
}
