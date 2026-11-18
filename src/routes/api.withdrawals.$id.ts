import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { guarded } from "@/lib/payments/http.server";
import { getWithdrawal, reconcileWithdrawal } from "@/lib/payments/withdrawals";

export const Route = createFileRoute("/api/withdrawals/$id")({
  server: {
    handlers: {
      GET: guarded({}, async ({ actor, params }) => {
        const ctx = getCtx();
        let w = await getWithdrawal(ctx, actor, params.id!);
        w = await reconcileWithdrawal(ctx, w); // lazy refresh while VERIFIED/PROCESSING
        return { withdrawal: w };
      }),
    },
  },
});
