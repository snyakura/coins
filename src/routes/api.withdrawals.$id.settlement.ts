import { createFileRoute } from "@tanstack/react-router";
import { ServiceError } from "@/lib/payments/common";
import { getCtx } from "@/lib/payments/context.server";
import { body, guarded } from "@/lib/payments/http.server";
import type { SettlementStatus } from "@/lib/payments/state";
import { advanceSettlement } from "@/lib/payments/withdrawals";

const ALLOWED = ["READY_FOR_SETTLEMENT", "SETTLEMENT_PROCESSING", "SETTLEMENT_COMPLETED"];

export const Route = createFileRoute("/api/withdrawals/$id/settlement")({
  server: {
    handlers: {
      POST: guarded({ admin: true }, async ({ actor, request, params }) => {
        const b = await body(request);
        if (typeof b.status !== "string" || !ALLOWED.includes(b.status)) throw new ServiceError(400, "Invalid settlement status.", "INVALID");
        return { withdrawal: await advanceSettlement(getCtx(), actor, params.id!, b.status as SettlementStatus, typeof b.reference === "string" ? b.reference : undefined) };
      }),
    },
  },
});
