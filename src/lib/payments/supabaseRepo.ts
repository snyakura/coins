import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry, Repo, Row, Table } from "./repo";

/** Server-only. Uses the service-role key, which bypasses RLS. Never import from browser code. */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const ok = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient = serviceClient()) {}

  async insert(table: Table, row: Row) { return ok(await this.db.from(table).insert(row).select().single()) as Row; }
  async get(table: Table, id: string) { return ok(await this.db.from(table).select("*").eq(table === "deriv_connections" ? "user_id" : "id", id).maybeSingle()) as Row | null; }
  async list(table: Table, f: { user_id?: string; status?: string | string[] } = {}, limit = 200) {
    let q = this.db.from(table).select("*").order("created_at", { ascending: false }).limit(limit);
    if (f.user_id) q = q.eq("user_id", f.user_id);
    if (f.status) q = Array.isArray(f.status) ? q.in("status", f.status) : q.eq("status", f.status);
    return ok(await q) as Row[];
  }
  // UPDATE ... WHERE id = ? AND status IN (...) is atomic in Postgres: exactly one concurrent caller gets a row back.
  async cas(table: "deposits" | "withdrawals", id: string, expected: string | string[], patch: Row) {
    const res = await this.db.from(table).update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id).in("status", ([] as string[]).concat(expected)).select();
    return (ok(res) as Row[])[0] ?? null;
  }
  async update(table: "deposits" | "withdrawals", id: string, patch: Row) {
    return ok(await this.db.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single()) as Row;
  }
  async upsertLedger(row: Row) { ok(await this.db.from("ledger").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "type,provider_request_id" })); }
  async updateLedger(type: string, requestId: string, patch: Row) {
    ok(await this.db.from("ledger").update({ ...patch, updated_at: new Date().toISOString() }).eq("type", type).eq("provider_request_id", requestId));
  }
  async listLedger(f: { user_id?: string } = {}, limit = 200) {
    let q = this.db.from("ledger").select("*").order("created_at", { ascending: false }).limit(limit);
    if (f.user_id) q = q.eq("user_id", f.user_id);
    return ok(await q) as Row[];
  }
  async audit(e: AuditEntry) { ok(await this.db.from("audit_log").insert(e)); }
  async getConnection(userId: string) { return ok(await this.db.from("deriv_connections").select("*").eq("user_id", userId).maybeSingle()) as Row | null; }
  async saveConnection(row: Row) { ok(await this.db.from("deriv_connections").upsert({ ...row, updated_at: new Date().toISOString() })); }
  async saveOAuthState(row: Row) { ok(await this.db.from("deriv_oauth_states").insert(row)); }
  async takeOAuthState(state: string) {
    const res = await this.db.from("deriv_oauth_states").delete().eq("state", state).select();
    return (ok(res) as Row[])[0] ?? null;
  }
}
