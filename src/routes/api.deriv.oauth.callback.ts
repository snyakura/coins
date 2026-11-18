import { createFileRoute } from "@tanstack/react-router";
import { encrypt } from "@/lib/deriv/crypto";
import { getDeriv } from "@/lib/deriv";
import { getCtx } from "@/lib/payments/context.server";

const back = (q: string) => new Response(null, { status: 302, headers: { Location: `/deriv?${q}`, "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/deriv/oauth/callback")({
  server: {
    handlers: {
      // Deriv redirects the browser here. The user is identified by the single-use `state` we stored, not by a cookie.
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const state = u.searchParams.get("state") ?? "";
        const code = u.searchParams.get("code");
        try {
          const ctx = getCtx();
          const saved = state ? await ctx.repo.takeOAuthState(state) : null; // consumed: a replay finds nothing
          if (!saved || !code || u.searchParams.get("error")) return back("connect=failed");
          const t = await getDeriv().provider.exchangeCode({ code, codeVerifier: saved.code_verifier });
          await ctx.repo.saveConnection({
            user_id: saved.user_id, deriv_nickname: saved.nickname, token_enc: encrypt(t.accessToken),
            token_expires_at: new Date(Date.now() + t.expiresIn * 1000).toISOString(), scope: "payment",
          });
          await ctx.repo.audit({ action: "DERIV_CONNECTED", user_id: saved.user_id, entity: "deriv_connection", entity_id: saved.user_id });
          return back("connect=ok");
        } catch (e) {
          console.error("[deriv] oauth callback failed", (e as Error).message);
          return back("connect=failed");
        }
      },
    },
  },
});
