export type Row = any; // DB rows: shape is defined by the SQL migration
export type Table = "deposits" | "withdrawals" | "ledger" | "deriv_connections";

export type AuditEntry = {
  action: string; user_id?: string | null; admin_id?: string | null; entity: string; entity_id: string;
  previous_status?: string | null; new_status?: string | null; provider_ref?: string | null; note?: string | null;
};

/** Storage abstraction. Supabase in production, in-memory for tests/dev without a database. */
export interface Repo {
  insert(table: Table, row: Row): Promise<Row>;
  get(table: Table, id: string): Promise<Row | null>;
  list(table: Table, filter?: { user_id?: string; status?: string | string[] }, limit?: number): Promise<Row[]>;
  /** Atomic compare-and-set on `status`. Returns the updated row, or null if the row was not in an expected status.
   *  This is the lock that makes approve / verify idempotent: only one caller can win a transition. */
  cas(table: "deposits" | "withdrawals", id: string, expected: string | string[], patch: Row): Promise<Row | null>;
  update(table: "deposits" | "withdrawals", id: string, patch: Row): Promise<Row>;
  upsertLedger(row: Row): Promise<void>;
  updateLedger(type: string, requestId: string, patch: Row): Promise<void>;
  listLedger(filter?: { user_id?: string }, limit?: number): Promise<Row[]>;
  audit(e: AuditEntry): Promise<void>;
  getConnection(userId: string): Promise<Row | null>;
  saveConnection(row: Row): Promise<void>;
  saveOAuthState(row: Row): Promise<void>;
  takeOAuthState(state: string): Promise<Row | null>; // single use
}

let seq = 0;
const uuid = () => globalThis.crypto.randomUUID();

export class MemoryRepo implements Repo {
  t: Record<string, Row[]> = { deposits: [], withdrawals: [], ledger: [], deriv_connections: [] };
  auditLog: Row[] = [];
  states = new Map<string, Row>();

  async insert(table: Table, row: Row) {
    const r: Row = { id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
    if (table === "deposits" || table === "withdrawals") {
      if (this.t[table]!.some((x) => x.deriv_request_id === r.deriv_request_id)) throw new Error("duplicate deriv_request_id");
    }
    this.t[table]!.push(r);
    return { ...r };
  }
  async get(table: Table, id: string) {
    const r = this.t[table]!.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async list(table: Table, f: { user_id?: string; status?: string | string[] } = {}, limit = 200) {
    const st = f.status ? ([] as string[]).concat(f.status) : null;
    return this.t[table]!
      .filter((x) => (!f.user_id || x.user_id === f.user_id) && (!st || st.includes(x.status)))
      .slice(-limit).reverse().map((x) => ({ ...x }));
  }
  async cas(table: "deposits" | "withdrawals", id: string, expected: string | string[], patch: Row) {
    const r = this.t[table]!.find((x) => x.id === id);
    if (!r || !([] as string[]).concat(expected).includes(r.status)) return null;
    Object.assign(r, patch, { updated_at: new Date().toISOString() });
    return { ...r };
  }
  async update(table: "deposits" | "withdrawals", id: string, patch: Row) {
    const r = this.t[table]!.find((x) => x.id === id)!;
    Object.assign(r, patch, { updated_at: new Date().toISOString() });
    return { ...r };
  }
  async upsertLedger(row: Row) {
    const i = this.t.ledger!.findIndex((x) => x.type === row.type && x.provider_request_id === row.provider_request_id);
    if (i >= 0) Object.assign(this.t.ledger![i]!, row, { updated_at: new Date().toISOString() });
    else this.t.ledger!.push({ id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row });
  }
  async updateLedger(type: string, requestId: string, patch: Row) {
    const r = this.t.ledger!.find((x) => x.type === type && x.provider_request_id === requestId);
    if (r) Object.assign(r, patch, { updated_at: new Date().toISOString() });
  }
  async listLedger(f: { user_id?: string } = {}, limit = 200) {
    return this.t.ledger!.filter((x) => !f.user_id || x.user_id === f.user_id).slice(-limit).reverse().map((x) => ({ ...x }));
  }
  async audit(e: AuditEntry) { this.auditLog.push({ id: ++seq, created_at: new Date().toISOString(), ...e }); }
  async getConnection(userId: string) { return this.t.deriv_connections!.find((x) => x.user_id === userId) ?? null; }
  async saveConnection(row: Row) {
    const i = this.t.deriv_connections!.findIndex((x) => x.user_id === row.user_id);
    if (i >= 0) this.t.deriv_connections![i] = { ...this.t.deriv_connections![i], ...row }; else this.t.deriv_connections!.push(row);
  }
  async saveOAuthState(row: Row) { this.states.set(row.state, row); }
  async takeOAuthState(state: string) { const r = this.states.get(state) ?? null; this.states.delete(state); return r; }
}
