import { createFileRoute } from "@tanstack/react-router";
import { ServiceError } from "@/lib/payments/common";
import { getCtx } from "@/lib/payments/context.server";
import { body, guarded } from "@/lib/payments/http.server";
import { createWithdrawal } from "@/lib/payments/withdrawals";

export const Route = createFileRoute("/api/withdrawals")({
  server: {
    handlers: {
      GET: guarded({}, async ({ actor, request }) => {
        const admin = new URL(request.url).searchParams.get("scope") === "admin";
        if (admin && !actor.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN");
        return { withdrawals: await getCtx().repo.list("withdrawals", admin ? {} : { user_id: actor.id }, 200) };
      }),
      POST: guarded({ limit: 10 }, async ({ actor, request }) => {
        const b = await body(request);
        return { withdrawal: await createWithdrawal(getCtx(), actor.id, { amount: b.amount, currency: b.currency, payoutMethod: b.payoutMethod, payoutDetails: b.payoutDetails }) };
      }),
    },
  },
});
