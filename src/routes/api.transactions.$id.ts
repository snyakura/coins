import { createFileRoute } from "@tanstack/react-router";
import { ServiceError } from "@/lib/payments/common";
import { getCtx } from "@/lib/payments/context.server";
import { guarded } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/transactions/$id")({
  server: {
    handlers: {
      GET: guarded({}, async ({ actor, params }) => {
        const row = (await getCtx().repo.listLedger(actor.isAdmin ? {} : { user_id: actor.id }, 1000)).find((t) => t.id === params.id);
        if (!row) throw new ServiceError(404, "Transaction not found.", "NOT_FOUND");
        return { transaction: row };
      }),
    },
  },
});
