import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { rejectDeposit } from "@/lib/payments/deposits";
import { body, guarded, preflight, publicDeposit } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deposits/$id/reject")({
  server: {
    handlers: {
      OPTIONS: preflight, // lets the staff dashboard (see STAFF_DASHBOARD_ORIGINS) call this from its own address
      POST: guarded({ admin: true, limit: 20, cors: true }, async ({ actor, request, params }) => {
        const reason = String((await body(request)).reason ?? "Payment could not be verified");
        return { deposit: publicDeposit(await rejectDeposit(getCtx(), actor, params.id!, reason), true) };
      }),
    },
  },
});