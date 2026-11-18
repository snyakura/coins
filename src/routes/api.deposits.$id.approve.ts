import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { approveDeposit } from "@/lib/payments/deposits";
import { guarded, publicDeposit } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deposits/$id/approve")({
  server: {
    handlers: {
      // Idempotent: a double click or a second admin gets 409 and Deriv is called at most once.
      POST: guarded({ admin: true, limit: 20 }, async ({ actor, params }) => ({
        deposit: publicDeposit(await approveDeposit(getCtx(), actor, params.id!), true),
      })),
    },
  },
});
