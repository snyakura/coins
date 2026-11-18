import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { api, STATUS_LABEL } from "@/lib/payments/api-client";
import { supabase } from "@/lib/supabase";
import { getVerifiedUser } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Payments admin — Coinspace" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const card = "rounded-2xl border border-white/10 bg-[#0b0b0b] p-4 text-white";
const btn = "rounded-md bg-[#f0b90b] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50";
const ghost = "rounded-md border border-white/20 px-3 py-1.5 text-xs text-white disabled:opacity-50";
const SETTLE_NEXT: Record<string, string> = { NONE: "READY_FOR_SETTLEMENT", READY_FOR_SETTLEMENT: "SETTLEMENT_PROCESSING", SETTLEMENT_PROCESSING: "SETTLEMENT_COMPLETED" };

function AdminPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "ledger">("deposits");
  const [rows, setRows] = useState<any[]>([]); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [view, setView] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const url = tab === "ledger" ? "/api/transactions?scope=admin" : `/api/${tab}?scope=admin`;
      const r = await api(url);
      setRows(r.deposits ?? r.withdrawals ?? r.transactions ?? []);
    } catch (e: any) { setMsg(e.message); }
  }, [tab]);
  useEffect(() => { getVerifiedUser().then(async (user) => { if (!user) return setOk(false); try { setOk((await api("/api/deriv/status")).isAdmin); } catch { setOk(false); } }); }, []);
  useEffect(() => { if (ok) load(); }, [ok, load]);

  const act = async (fn: () => Promise<any>, success: string) => {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(success); } catch (e: any) { setMsg(e.message); }
    setBusy(false); load();
  };
  const open = async (id: string) => { const r = await api(`/api/deposits/${id}`); setView(r.deposit); load(); };

  if (ok === null) return null;
  if (!ok) return <CoinspaceShell><main className="px-4 py-32 text-center text-white/70">Admin access required.</main></CoinspaceShell>;
  return (
    <CoinspaceShell>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-28">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-bold text-white">Payments admin</h1>
          {(["deposits", "withdrawals", "ledger"] as const).map((t) => <button key={t} className={tab === t ? btn : ghost} onClick={() => setTab(t)}>{t}</button>)}
          <button className={ghost} disabled={busy} onClick={() => act(() => api("/api/deriv/reconcile", { method: "POST", json: {} }), "Reconciled with Deriv.")}>Reconcile now</button>
        </div>
        {msg && <p className="rounded-lg bg-white/5 px-3 py-2 text-sm text-amber-300">{msg}</p>}
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-left text-xs text-white/80">
            <thead className="text-white/40"><tr>
              {tab === "ledger"
                ? ["Type", "Dir", "Amount", "Status", "Provider req", "Provider tx", "Method", "When"].map((h) => <th key={h} className="p-2">{h}</th>)
                : ["ID", "Customer", "Amount", "Method", tab === "deposits" ? "Reference" : "Payout", "Status", "Deriv req / tx", "Created", ""].map((h) => <th key={h} className="p-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => tab === "ledger" ? (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-2">{r.type}</td><td className="p-2">{r.direction}</td><td className="p-2">{r.amount} {r.currency}</td><td className="p-2">{r.status}</td>
                  <td className="p-2 font-mono">{r.provider_request_id}</td><td className="p-2 font-mono">{r.provider_transaction_id ?? "—"}</td><td className="p-2">{r.payment_method}</td><td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t border-white/10 align-top">
                  <td className="p-2 font-mono">{r.id.slice(0, 8)}</td><td className="p-2 font-mono">{r.user_id.slice(0, 8)}{r.deriv_nickname ? ` · ${r.deriv_nickname}` : ""}</td>
                  <td className="p-2">{r.amount} {r.currency}{tab === "deposits" ? <div className="text-white/40">net {r.net_amount}</div> : <div className="text-white/40">payout {r.net_payout}</div>}</td>
                  <td className="p-2">{r.payment_method ?? r.payout_method}</td>
                  <td className="p-2">{tab === "deposits" ? (r.payment_reference ?? "—") : r.payout_details}{r.has_proof ? <div className="text-emerald-300">proof ✓</div> : null}</td>
                  <td className="p-2"><div>{STATUS_LABEL[r.status]?.label ?? r.status}</div>{tab === "withdrawals" && <div className="text-white/40">{r.settlement_status}</div>}{r.error_message && <div className="text-red-300">{r.error_message}</div>}</td>
                  <td className="p-2 font-mono">{r.deriv_request_id}<div className="text-white/40">{r.deriv_transaction_id ?? "—"}</div></td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}{r.verified_at && <div className="text-white/40">verified {new Date(r.verified_at).toLocaleString()}</div>}</td>
                  <td className="space-x-1 p-2 whitespace-nowrap">
                    {tab === "deposits" && <>
                      <button className={ghost} disabled={busy} onClick={() => open(r.id)}>View</button>
                      {["PAYMENT_SUBMITTED", "UNDER_REVIEW"].includes(r.status) && <>
                        <button className={btn} disabled={busy} onClick={() => { if (confirm(`Approve ${r.amount} and send ${r.net_amount} to ${r.deriv_nickname} on Deriv?`)) act(() => api(`/api/deposits/${r.id}/approve`, { method: "POST", json: {} }), "Approved. Deriv transfer started."); }}>Approve</button>
                        <button className={ghost} disabled={busy} onClick={() => { const reason = prompt("Reason for rejection?"); if (reason) act(() => api(`/api/deposits/${r.id}/reject`, { json: { reason } }), "Rejected."); }}>Reject</button>
                      </>}
                    </>}
                    {tab === "withdrawals" && r.status === "COMPLETED" && SETTLE_NEXT[r.settlement_status] && (
                      <button className={btn} disabled={busy} onClick={() => { const next = SETTLE_NEXT[r.settlement_status]!; const reference = next === "SETTLEMENT_COMPLETED" ? prompt("External payout reference?") ?? undefined : undefined; act(() => api(`/api/withdrawals/${r.id}/settlement`, { json: { status: next, reference } }), "Settlement updated."); }}>
                        → {SETTLE_NEXT[r.settlement_status]!.replaceAll("_", " ").toLowerCase()}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-4 text-white/50">Nothing here yet.</p>}
        </div>
        {view && (
          <div className={`${card} space-y-2 text-sm`}>
            <div className="flex justify-between"><b>Deposit {view.id.slice(0, 8)}</b><button className={ghost} onClick={() => setView(null)}>Close</button></div>
            <div>{view.amount} {view.currency} via {view.payment_method} · ref {view.payment_reference ?? "—"} · status {view.status}</div>
            {view.proof_url ? (/\.pdf/.test(view.proof_path ?? "") ? <a className="text-[#f0b90b] underline" href={view.proof_url} target="_blank" rel="noreferrer">Open proof (PDF)</a> : <img src={view.proof_url} alt="Proof of payment" className="max-h-96 rounded-lg" />) : <p className="text-white/50">No proof uploaded.</p>}
          </div>
        )}
      </main>
    </CoinspaceShell>
  );
}
