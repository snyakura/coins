import { createFileRoute } from "@tanstack/react-router";
import { getDeriv } from "@/lib/deriv";
import { getCtx } from "@/lib/payments/context.server";
import { guarded } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deriv/status")({
  server: {
    handlers: {
      // Never returns the token, only whether a usable connection exists.
      GET: guarded({}, async ({ actor }) => {
        const c = await getCtx().repo.getConnection(actor.id);
        const connected = !!c && new Date(c.token_expires_at).getTime() > Date.now();
        return { connected, nickname: connected ? c!.deriv_nickname : null, expiresAt: c?.token_expires_at ?? null, mock: getDeriv().cfg.mock, isAdmin: actor.isAdmin };
      }),
    },
  },
});
