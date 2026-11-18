import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { guarded } from "@/lib/payments/http.server";
import { requestVerification } from "@/lib/payments/withdrawals";

export const Route = createFileRoute("/api/withdrawals/$id/request-verification")({
  server: {
    handlers: {
      POST: guarded({ limit: 5 }, async ({ actor, params }) => ({ withdrawal: await requestVerification(getCtx(), actor.id, params.id!) })),
    },
  },
});
