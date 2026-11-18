import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { body, guarded } from "@/lib/payments/http.server";
import { verifyWithdrawal } from "@/lib/payments/withdrawals";

export const Route = createFileRoute("/api/withdrawals/$id/verify")({
  server: {
    handlers: {
      // The code is read from the body, passed straight to Deriv and never logged or stored.
      POST: guarded({ limit: 8 }, async ({ actor, request, params }) => ({
        withdrawal: await verifyWithdrawal(getCtx(), actor.id, params.id!, (await body(request)).code),
      })),
    },
  },
});
