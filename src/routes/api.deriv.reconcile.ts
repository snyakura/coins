import { createFileRoute } from "@tanstack/react-router";
import { getCtx } from "@/lib/payments/context.server";
import { authenticate, json } from "@/lib/payments/http.server";
import { reconcileAll } from "@/lib/payments/reconcile";

// Call from a cron (Authorization: Bearer $CRON_SECRET) or an admin session. Safe to run as often as you like:
// it only reads Deriv status (or re-sends an existing request_id, which Deriv dedupes).
async function handler({ request }: { request: Request }) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(secret && bearer && bearer === secret)) {
    try { if (!(await authenticate(request)).isAdmin) return json({ error: "Not allowed." }, 403); }
    catch { return json({ error: "Not allowed." }, 401); }
  }
  return json(await reconcileAll(getCtx()));
}

export const Route = createFileRoute("/api/deriv/reconcile")({
  server: { handlers: { POST: handler, GET: handler } },
});
