import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Clock } from "lucide-react";
import { Logo } from "@/components/CoinspaceShell";
import { LINKS } from "@/lib/links";
import { supabase } from "@/lib/supabase";
import { getVerifiedUser } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  // Only same-site paths are accepted for ?next= (prevents redirecting people to other websites).
  validateSearch: (s: Record<string, unknown>) => {
    const next = s["next"];
    return {
      next: typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/deriv",
      mode: s["mode"] === "login" ? ("login" as const) : ("signup" as const),
    };
  },
  head: () => ({ meta: [{ title: "Sign in or create account — Coinspace" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

const field = "mt-1.5 h-11 w-full rounded-lg border border-border bg-white px-3.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-primary/60";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function AuthPage() {
  const { next, mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login" | "reset" | "newpw">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const done = () => navigate({ to: next as never });

  useEffect(() => {
    getVerifiedUser().then((u) => { if (u) done(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setMode("newpw"); // arrived from the reset-password email
      else if (event === "SIGNED_IN" && session) done();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const friendly = (m: string) =>
    /invalid login/i.test(m) ? "Incorrect email or password."
    : /already registered|already been registered/i.test(m) ? "That email already has an account. Please log in."
    : /password/i.test(m) && /characters|weak/i.test(m) ? "Your password must be at least 8 characters."
    : /rate|too many/i.test(m) ? "Too many attempts. Please wait a minute and try again."
    : "Something went wrong. Please try again.";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/auth?next=${encodeURIComponent(next)}&mode=login` } });
        if (err) throw err;
        if (!data.session) { setInfo("Almost done. We've sent a confirmation link to your email. Open it, then log in."); setMode("login"); setPassword(""); }
      } else if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      } else if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth?next=${encodeURIComponent(next)}` });
        if (err) throw err;
        setInfo("If that email has an account, a reset link is on its way.");
      } else {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setInfo("Password updated."); done();
      }
    } catch (err) {
      setError(friendly((err as Error).message ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth?next=${encodeURIComponent(next)}` } });
    if (err) setError("Google sign-in isn't available right now. Please use your email.");
  };

  const title = { signup: "Create account", login: "Welcome back", reset: "Reset password", newpw: "Set a new password" }[mode];
  const sub = {
    signup: "Create your Coinspace account to deposit and withdraw.",
    login: "Log in to continue with your deposit or withdrawal.",
    reset: "Enter your email and we'll send you a reset link.",
    newpw: "Choose a new password for your account.",
  }[mode];

  return (
    <div className="grid min-h-screen bg-white font-sans text-neutral-900 lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex"><Logo /></div>
        <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-[15px] text-neutral-500">{sub}</p>

          {(mode === "signup" || mode === "login") && (
            <>
              <button type="button" onClick={google} className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white text-[15px] font-semibold transition hover:bg-neutral-50">
                <GoogleIcon /> {mode === "signup" ? "Sign up with Google" : "Log in with Google"}
              </button>
              <div className="my-6 flex items-center gap-3 text-xs font-medium text-neutral-400">
                <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className={mode === "signup" || mode === "login" ? "" : "mt-8"} noValidate={false}>
            {mode !== "newpw" && (
              <label className="block text-sm font-semibold">
                Email<span aria-hidden="true">*</span>
                <input className={field} type="email" required autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}
            {mode !== "reset" && (
              <label className="mt-4 block text-sm font-semibold">
                {mode === "newpw" ? "New password" : "Password"}<span aria-hidden="true">*</span>
                <input className={field} type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "login" ? "Enter your password" : "Create a password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                {mode !== "login" && <span className="mt-1.5 block text-sm font-normal text-neutral-500">Must be at least 8 characters.</span>}
              </label>
            )}
            {mode === "login" && (
              <button type="button" onClick={() => { setMode("reset"); setError(""); setInfo(""); }} className="mt-3 text-sm font-semibold text-neutral-700 underline-offset-2 hover:underline">Forgot password?</button>
            )}

            {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {info && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}

            <button disabled={busy} className="mt-6 h-11 w-full rounded-lg bg-neutral-900 text-[15px] font-semibold text-white transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60">
              {busy ? "Please wait…" : { signup: "Create account", login: "Log in", reset: "Send reset link", newpw: "Update password" }[mode]}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600">
            {mode === "signup" ? <>Already have an account? <button className="font-bold text-neutral-900 underline underline-offset-2" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Log in</button></>
              : mode === "login" ? <>New to Coinspace? <button className="font-bold text-neutral-900 underline underline-offset-2" onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>Create account</button></>
              : <button className="font-bold text-neutral-900 underline underline-offset-2" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Back to log in</button>}
          </p>
        </div>
      </div>

      {/* Right: what the account is for */}
      <aside className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative w-full max-w-md text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Coinspace</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight">Fund and cash out your trading account, simply.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Deposit to and withdraw from your Weltrade and Deriv accounts using EcoCash, InnBucks, FNB or USDT. Track every step in one place.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/50">
              <span>Your transactions</span><span>Sample</span>
            </div>
            {[
              { icon: ArrowDownToLine, label: "Deposit to Deriv", sub: "EcoCash", amt: "$100.00", status: "Completed", ok: true },
              { icon: ArrowUpFromLine, label: "Withdraw from Deriv", sub: "InnBucks", amt: "$50.00", status: "Processing", ok: false },
            ].map((t) => (
              <div key={t.label} className="mt-4 flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><t.icon className="size-5" /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{t.label}</div><div className="text-xs text-white/50">{t.sub}</div></div>
                <div className="text-right">
                  <div className="text-sm font-bold">{t.amt}</div>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-xs font-semibold ${t.ok ? "text-emerald-400" : "text-amber-300"}`}>
                    {t.ok ? <Check className="size-3" /> : <Clock className="size-3" />}{t.status}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-6 space-y-2.5 text-sm text-white/75">
            {["Secure sign-in, only you can see your transactions", "Clear status at every step, from payment to payout", "Support on WhatsApp whenever you need it"].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t}</li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-5 border-t border-white/10 pt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Works with</span>
            <img src={LINKS.weltradeLogo} alt="Weltrade" className="h-7 w-auto rounded bg-white p-1 object-contain" />
            <img src={LINKS.derivLogo} alt="Deriv" className="h-7 w-auto rounded bg-white p-1 object-contain" />
          </div>
        </div>
      </aside>
    </div>
  );
}
