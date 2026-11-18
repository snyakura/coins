import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { ServiceError } from "@/lib/payments/common";
import { createDeposit } from "@/lib/payments/deposits";
import { body, guarded, publicDeposit } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deposits")({
  server: {
    handlers: {
      // GET /api/deposits            -> the caller's own deposits
      // GET /api/deposits?scope=admin -> every deposit (admin only)
      GET: guarded({}, async ({ actor, request }) => {
        const ctx = getCtx();
        const admin = new URL(request.url).searchParams.get("scope") === "admin";
        if (admin && !actor.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN");
        const rows = await ctx.repo.list("deposits", admin ? {} : { user_id: actor.id }, 200);
        return { deposits: rows.map((r) => publicDeposit(r, admin)) };
      }),
      POST: guarded({ limit: 10 }, async ({ actor, request }) => {
        const b = await body(request);
        // user_id, fee, net amount, status and request_id are all derived server-side; client values are ignored.
        const d = await createDeposit(getCtx(), actor.id, { amount: b.amount, currency: b.currency, paymentMethod: b.paymentMethod, derivNickname: b.derivNickname });
        return { deposit: publicDeposit(d, false) };
      }),
    },
  },
});
