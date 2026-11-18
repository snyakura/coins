import { createFileRoute } from "@tanstack/react-router";
import { ServiceError } from "@/lib/payments/common";
import { getCtx } from "@/lib/payments/context.server";
import { guarded } from "@/lib/payments/http.server";
import { summary } from "@/lib/payments/reconcile";

export const Route = createFileRoute("/api/transactions")({
  server: {
    handlers: {
      GET: guarded({}, async ({ actor, request }) => {
        const ctx = getCtx();
        const all = new URL(request.url).searchParams.get("scope") === "admin";
        if (all && !actor.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN");
        const transactions = await ctx.repo.listLedger(all ? {} : { user_id: actor.id }, 200);
        return { transactions, ...(all ? {} : { summary: await summary(ctx, actor.id) }) };
      }),
    },
  },
});
