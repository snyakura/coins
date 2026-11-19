import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { approveDeposit } from "@/lib/payments/deposits";
import { guarded, preflight, publicDeposit } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deposits/$id/approve")({
  server: {
    handlers: {
      OPTIONS: preflight, // lets the staff dashboard (see STAFF_DASHBOARD_ORIGINS) call this from its own address
      // Idempotent: a double click or a second admin gets 409 and Deriv is called at most once.
      POST: guarded({ admin: true, limit: 20, cors: true }, async ({ actor, params }) => ({
        deposit: publicDeposit(await approveDeposit(getCtx(), actor, params.id!), true),
      })),
    },
  },
});