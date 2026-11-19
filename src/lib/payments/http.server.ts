import { ServiceError, type Actor } from "./common";
import { InvalidTransition } from "./state";
import { serviceClient } from "./supabaseRepo";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/**
 * Browsers the staff dashboard runs in may call the admin endpoints that opt in with `cors: true`.
 * Set STAFF_DASHBOARD_ORIGINS to the dashboard's address(es), comma-separated, for example
 * "https://staff.example.com". Leave it empty and no other website is allowed. The login token is still required either way.
 */
const staffOrigins = () =>
  (process.env.STAFF_DASHBOARD_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !staffOrigins().includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Answers the browser's OPTIONS "preflight" check that comes before a cross-origin POST with an Authorization header. */
export const preflight = ({ request }: { request: Request }) => new Response(null, { status: 204, headers: corsHeaders(request) });

/** Bearer-token auth (Supabase access token in the Authorization header, not a cookie, so no CSRF surface). Role comes from app_metadata, which users cannot edit. */
export async function authenticate(request: Request): Promise<Actor> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new ServiceError(401, "Please sign in.", "UNAUTHENTICATED");
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new ServiceError(401, "Please sign in again.", "UNAUTHENTICATED");
  return { id: data.user.id, isAdmin: data.user.app_metadata?.role === "admin" };
}

// Fixed-window limiter. In-memory = per server instance; swap for Upstash/Redis if you scale out on Vercel.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw new ServiceError(429, "Too many requests. Please wait a moment.", "RATE_LIMITED");
}

type Opts = { admin?: boolean; limit?: number; cors?: boolean };
/** Wraps a handler: auth, admin check, rate limit, uniform JSON errors. Technical errors are logged, never returned. */
export function guarded(opts: Opts, fn: (a: { actor: Actor; request: Request; params: Record<string, string> }) => Promise<unknown>) {
  const respond = async (request: Request, params: Record<string, string>): Promise<Response> => {
    try {
      const actor = await authenticate(request);
      if (opts.admin && !actor.isAdmin) throw new ServiceError(403, "Not allowed.", "FORBIDDEN");
      rateLimit(`${actor.id}:${request.method}:${new URL(request.url).pathname.replace(/[0-9a-f-]{36}/g, ":id")}`, opts.limit ?? 30);
      return json(await fn({ actor, request, params }));
    } catch (e) {
      if (e instanceof ServiceError) return json({ error: e.message, code: e.code }, e.status);
      if (e instanceof InvalidTransition) return json({ error: "That action isn't allowed in the current status.", code: "INVALID_TRANSITION" }, 409);
      console.error("[api] unexpected", (e as Error)?.message);
      return json({ error: "Unable to process the transaction at the moment. Please try again later.", code: "ERROR" }, 500);
    }
  };
  return async ({ request, params }: { request: Request; params?: Record<string, string> }) => {
    const res = await respond(request, params ?? {});
    // Success and error answers both carry the CORS headers, so the staff dashboard can read the error message.
    if (opts.cors) for (const [k, v] of Object.entries(corsHeaders(request))) res.headers.set(k, v);
    return res;
  };
}

export const body = async (request: Request): Promise<Record<string, unknown>> => {
  try { const b = await request.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; }
};

/** Strip fields customers shouldn't see (proof path is admin-only). */
export const publicDeposit = (d: Record<string, any>, admin: boolean) => {
  const { proof_path, reviewed_by, ...rest } = d;
  return admin ? { ...rest, has_proof: !!proof_path, proof_path, reviewed_by } : { ...rest, has_proof: !!proof_path };
};