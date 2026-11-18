import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { api, PAY_DETAILS, STATUS_LABEL } from "@/lib/payments/api-client";
import { supabase } from "@/lib/supabase";
import { getVerifiedUser } from "@/lib/session";

export const Route = createFileRoute("/deriv")({
  head: () => ({ meta: [{ title: "Deriv deposits & withdrawals — Coinspace" }] }),
  component: DerivPage,
});

const card = "rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 text-white";
const input = "w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#f0b90b]";
const btn = "rounded-lg bg-[#f0b90b] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50";
const ghost = "rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50";

function Badge({ s }: { s: string }) {
  const m = STATUS_LABEL[s] ?? { label: s, tone: "wait" as const };
  const c = m.tone === "ok" ? "bg-emerald-500/15 text-emerald-300" : m.tone === "bad" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{m.label}</span>;
}

function DerivPage() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    getVerifiedUser().then((u) => setSession(!!u));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <CoinspaceShell>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-28">
        <h1 className="text-2xl font-bold text-white">Deriv deposits &amp; withdrawals</h1>
        {session === null ? null : session ? <Dashboard /> : <RedirectToAuth />}
      </main>
    </CoinspaceShell>
  );
}

function RedirectToAuth() {
  useEffect(() => { window.location.replace("/auth?next=/deriv"); }, []);
  return <p className="text-white/60">Redirecting to sign in…</p>;
}

function SignIn() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = mode === "in" ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw });
    setBusy(false);
    setMsg(error ? error.message : mode === "up" ? "Check your email to confirm your account, then sign in." : "");
  };
  return (
    <form onSubmit={go} className={`${card} space-y-3`}>
      <p className="text-sm text-white/70">Sign in to deposit to or withdraw from your Deriv account.</p>
      <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={input} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
      <div className="flex gap-2">
        <button className={btn} disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
        <button type="button" className={ghost} onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create account" : "I have an account"}</button>
      </div>
    </form>
  );
}

function Dashboard() {
  const [st, setSt] = useState<any>(null);
  const [deps, setDeps] = useState<any[]>([]); const [wds, setWds] = useState<any[]>([]); const [sum, setSum] = useState<any>(null);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const refresh = useCallback(async () => {
    const [s, d, w, t] = await Promise.all([api("/api/deriv/status"), api("/api/deposits"), api("/api/withdrawals"), api("/api/transactions")]).catch(() => [null, null, null, null] as any[]);
    if (s) setSt(s); if (d) setDeps(d.deposits); if (w) setWds(w.withdrawals); if (t) setSum(t.summary);
  }, []);
  useEffect(() => { refresh(); const i = setInterval(refresh, 8000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { if (new URLSearchParams(location.search).get("connect")) refresh(); }, [refresh]);
  if (!st) return <p className="text-white/60">Loading…</p>;
  return (
    <>
      {st.mock && <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-300">Test mode: Deriv is simulated, no real money moves.</p>}
      <Connect st={st} onDone={refresh} />
      {sum && (
        <div className={`${card} grid grid-cols-2 gap-3 text-sm sm:grid-cols-4`}>
          {[["Deposits in progress", sum.pending_deposits], ["Deposited", sum.completed_deposits], ["Withdrawals in progress", sum.pending_withdrawals], ["Withdrawn", sum.completed_withdrawals]].map(([k, v]) => (
            <div key={String(k)}><div className="text-white/50">{k}</div><div className="text-lg font-semibold text-[#f0b90b]">${Number(v).toFixed(2)}</div></div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button key={t} className={tab === t ? btn : ghost} onClick={() => setTab(t)}>{t === "deposit" ? "Deposit" : "Withdraw"}</button>
        ))}
        <button className={`${ghost} ml-auto`} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      {tab === "deposit" ? <Deposit st={st} deps={deps} onDone={refresh} /> : <Withdraw st={st} wds={wds} onDone={refresh} />}
    </>
  );
}

function Connect({ st, onDone }: { st: any; onDone: () => void }) {
  const [nick, setNick] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const flag = typeof location !== "undefined" ? new URLSearchParams(location.search).get("connect") : null;
  const go = async () => {
    setBusy(true); setErr("");
    try { const { url } = await api("/api/deriv/connect", { json: { nickname: nick } }); location.href = url; onDone(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  if (st.connected) return <div className={`${card} flex items-center justify-between text-sm`}><span>Deriv account <b className="text-[#f0b90b]">{st.nickname}</b> connected</span></div>;
  return (
    <div className={`${card} space-y-3`}>
      <p className="text-sm text-white/70">Connect your Deriv account to withdraw. You'll approve the “payment” permission on Deriv; we never see your password.</p>
      {flag === "failed" && <p className="text-sm text-red-300">The connection didn't complete. Please try again.</p>}
      <input className={input} placeholder="Your Deriv account nickname" value={nick} onChange={(e) => setNick(e.target.value)} />
      {err && <p className="text-sm text-red-300">{err}</p>}
      <button className={btn} disabled={busy || nick.length < 2} onClick={go}>Connect Deriv account</button>
    </div>
  );
}

function Deposit({ st, deps, onDone }: { st: any; deps: any[]; onDone: () => void }) {
  const [amount, setAmount] = useState("50"); const [method, setMethod] = useState("Ecocash"); const [nick, setNick] = useState(st.nickname ?? "");
  const [cur, setCur] = useState<any>(null); const [ref, setRef] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const create = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { setCur((await api("/api/deposits", { json: { amount, currency: "USD", paymentMethod: method, derivNickname: nick } })).deposit); onDone(); }
    catch (x: any) { setErr(x.message); } setBusy(false);
  };
  const upload = async () => {
    if (!file || !cur) return; setBusy(true); setErr("");
    const f = new FormData(); f.set("file", file); f.set("reference", ref);
    try { setCur((await api(`/api/deposits/${cur.id}/proof`, { form: f })).deposit); onDone(); } catch (x: any) { setErr(x.message); } setBusy(false);
  };
  return (
    <div className="space-y-4">
      {!cur || cur.status !== "PENDING_PAYMENT" ? (
        <form onSubmit={create} className={`${card} space-y-3`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/60">Amount (USD)<input className={input} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
            <label className="text-xs text-white/60">Payment method
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>{Object.keys(PAY_DETAILS).map((m) => <option key={m}>{m}</option>)}</select></label>
          </div>
          <label className="block text-xs text-white/60">Deriv nickname to credit<input className={input} value={nick} onChange={(e) => setNick(e.target.value)} /></label>
          {err && <p className="text-sm text-red-300">{err}</p>}
          <button className={btn} disabled={busy}>Continue</button>
        </form>
      ) : (
        <div className={`${card} space-y-3 text-sm`}>
          <p>Send <b className="text-[#f0b90b]">${Number(cur.amount).toFixed(2)}</b> via {cur.payment_method}:</p>
          <p className="rounded-lg bg-white/5 p-3 font-mono text-xs">{PAY_DETAILS[cur.payment_method]}</p>
          <p className="text-white/60">Fee ${Number(cur.fee).toFixed(2)}. You'll receive <b>${Number(cur.net_amount).toFixed(2)}</b> in Deriv. Reference: <b>{cur.deriv_request_id}</b></p>
          <input className={input} placeholder="Payment reference from your receipt" value={ref} onChange={(e) => setRef(e.target.value)} />
          <input className={input} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {err && <p className="text-sm text-red-300">{err}</p>}
          <button className={btn} disabled={busy || !file || ref.length < 3} onClick={upload}>Submit proof of payment</button>
        </div>
      )}
      <History rows={deps} kind="deposit" />
    </div>
  );
}

function Withdraw({ st, wds, onDone }: { st: any; wds: any[]; onDone: () => void }) {
  const [amount, setAmount] = useState("50"); const [method, setMethod] = useState("Ecocash"); const [details, setDetails] = useState("");
  const [cur, setCur] = useState<any>(null); const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(""); try { await fn(); onDone(); } catch (x: any) { setErr(x.message); } setBusy(false); };
  if (!st.connected) return <p className={`${card} text-sm text-white/70`}>Connect your Deriv account above to withdraw.</p>;
  const live = cur && wds.find((w) => w.id === cur.id) || cur;
  return (
    <div className="space-y-4">
      {!live || ["COMPLETED", "FAILED", "REJECTED", "CANCELLED"].includes(live.status) ? (
        <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); run(async () => { setCode(""); setCur((await api("/api/withdrawals", { json: { amount, currency: "USD", payoutMethod: method, payoutDetails: details } })).withdrawal); }); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/60">Amount (USD)<input className={input} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
            <label className="text-xs text-white/60">Get paid via
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>{["Ecocash", "InnBucks", "FNB BUSINESS ACCOUNT", "USDT"].map((m) => <option key={m}>{m}</option>)}</select></label>
          </div>
          <input className={input} placeholder="Your payout number / account / wallet" value={details} onChange={(e) => setDetails(e.target.value)} />
          {err && <p className="text-sm text-red-300">{err}</p>}
          <button className={btn} disabled={busy || details.length < 4}>Request withdrawal</button>
        </form>
      ) : (
        <div className={`${card} space-y-3 text-sm`}>
          <div className="flex items-center justify-between"><span>${Number(live.amount).toFixed(2)} withdrawal</span><Badge s={live.status} /></div>
          <p className="text-white/60">{STATUS_LABEL[live.status]?.next}</p>
          {live.status === "REQUESTED" && <button className={btn} disabled={busy} onClick={() => run(async () => setCur((await api(`/api/withdrawals/${live.id}/request-verification`, { method: "POST" })).withdrawal))}>Send verification code</button>}
          {live.status === "VERIFICATION_REQUIRED" && (
            <>
              <p className="text-white/70">Verification code sent to your registered Deriv contact.</p>
              <input className={`${input} tracking-[0.4em]`} inputMode="numeric" maxLength={6} placeholder="Verification code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
              <div className="flex gap-2">
                <button className={btn} disabled={busy || code.length !== 6} onClick={() => run(async () => { const w = (await api(`/api/withdrawals/${live.id}/verify`, { json: { code } })).withdrawal; setCode(""); setCur(w); })}>Confirm withdrawal</button>
                <button className={ghost} disabled={busy} onClick={() => run(async () => setCur((await api(`/api/withdrawals/${live.id}/request-verification`, { method: "POST" })).withdrawal))}>Resend code</button>
              </div>
            </>
          )}
          {err && <p className="text-sm text-red-300">{err}</p>}
        </div>
      )}
      <History rows={wds} kind="withdrawal" />
    </div>
  );
}

function History({ rows, kind }: { rows: any[]; kind: "deposit" | "withdrawal" }) {
  if (!rows.length) return null;
  return (
    <div className={`${card} space-y-2`}>
      <h2 className="text-sm font-semibold">Your {kind}s</h2>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm">
          <div><div>${Number(r.amount).toFixed(2)} <span className="text-white/40">· {r.deriv_request_id}</span></div>
            <div className="text-xs text-white/50">{STATUS_LABEL[r.status]?.next ?? new Date(r.created_at).toLocaleString()}</div>
            {kind === "withdrawal" && r.status === "COMPLETED" && <div className="text-xs text-white/50">Payout: {r.settlement_status.replaceAll("_", " ").toLowerCase()}</div>}</div>
          <Badge s={r.status} />
        </div>
      ))}
    </div>
  );
}
