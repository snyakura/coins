import { createFileRoute } from "@tanstack/react-router";
import { pkce } from "@/lib/deriv/crypto";
import { getDeriv } from "@/lib/deriv";
import { ServiceError } from "@/lib/payments/common";
import { getCtx } from "@/lib/payments/context.server";
import { body, guarded } from "@/lib/payments/http.server";

export const Route = createFileRoute("/api/deriv/connect")({
  server: {
    handlers: {
      // Starts Authorization Code + PKCE. The verifier stays on the server; the browser only gets the Deriv URL.
      POST: guarded({ limit: 6 }, async ({ actor, request }) => {
        const nickname = String((await body(request)).nickname ?? "").trim();
        if (!/^[A-Za-z0-9_.-]{2,64}$/.test(nickname)) throw new ServiceError(400, "Please enter a valid Deriv nickname.", "INVALID_NICKNAME");
        const { verifier, challenge, state } = pkce();
        await getCtx().repo.saveOAuthState({ state, user_id: actor.id, code_verifier: verifier, nickname });
        return { url: getDeriv().provider.buildAuthorizeUrl({ state, codeChallenge: challenge }) };
      }),
    },
  },
});
