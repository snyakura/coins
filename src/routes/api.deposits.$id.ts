import { createFileRoute } from "@tanstack/react-router";
import { getCtx, signedProofUrl } from "@/lib/payments/context.server";
import { getOwnDeposit, startReview } from "@/lib/payments/deposits";
import { guarded, publicDeposit } from "@/lib/payments/http.server";
import { reconcileDeposit } from "@/lib/payments/deposits";

export const Route = createFileRoute("/api/deposits/$id")({
  server: {
    handlers: {
      GET: guarded({}, async ({ actor, params }) => {
        const ctx = getCtx();
        let d = await getOwnDeposit(ctx, actor, params.id!);
        if (actor.isAdmin && d.status === "PAYMENT_SUBMITTED") d = await startReview(ctx, actor, d.id); // opening it = review started
        if (d.status === "PROCESSING_DERIV") d = await reconcileDeposit(ctx, d); // lazy status refresh, read-only against Deriv
        const view = publicDeposit(d, actor.isAdmin) as Record<string, unknown>;
        if (actor.isAdmin && d.proof_path) view.proof_url = await signedProofUrl(d.proof_path);
        return { deposit: view };
      }),
    },
  },
});
