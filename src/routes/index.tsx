import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bolt, CreditCard, FileText, Send, ShieldCheck, UserRound } from "lucide-react";
import { CoinspaceShell, useTransactionActions } from "@/components/CoinspaceShell";
import { MarketChart } from "@/components/MarketChart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Coinspace — Buy and sell crypto. Fast." },
    { name: "description", content: "Deposit, trade and withdraw with Coinspace while keeping control of your funds." },
    { property: "og:title", content: "Coinspace — Buy and sell crypto. Fast." },
    { property: "og:description", content: "Trade global markets on your terms." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: HomePage,
});

function HomePage() {
  const openChat = useTransactionActions();
  const benefits = [
    { icon: ShieldCheck, title: "Non-custodial", text: "You stay in control" },
    { icon: BarChart3, title: "Global markets", text: "Crypto and forex" },
    { icon: Bolt, title: "Fast and secure", text: "Built for everyone" },
  ];
  const steps = [
    { icon: UserRound, title: "Create your account", text: "Sign up in minutes and verify your details." },
    { icon: CreditCard, title: "Tap Deposit and send payment", text: "Choose your preferred payment method." },
    { icon: FileText, title: "Send proof and we confirm", text: "Upload your payment proof and we’ll confirm quickly." },
    { icon: Send, title: "Withdraw to your account anytime", text: "Funds go directly to your account." },
  ];
  return <CoinspaceShell>
    <main>
      <section className="page-container grid items-center gap-12 py-10 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
        <div>
          <span className="inline-flex rounded-full bg-accent px-4 py-2 text-xs font-semibold">Trade global markets. On your terms.</span>
          <h1 className="mt-5 max-w-[650px] text-5xl font-extrabold leading-[.98] sm:text-6xl lg:text-7xl">Buy and sell<br />crypto. Fast.</h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">Deposit, trade and withdraw. Coinspace never holds your funds.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="dark" className="min-w-40" onClick={() => openChat("deposit")}>Deposit <ArrowRight size={17} /></Button>
            <Button variant="outline" className="min-w-40" onClick={() => openChat("withdraw")}>Withdraw <ArrowRight size={17} /></Button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3 border-r border-border last:border-0"><Icon className="shrink-0" /><div><p className="text-xs font-bold">{title}</p><p className="text-[11px] text-muted-foreground">{text}</p></div></div>)}
          </div>
        </div>
        <div className="panel overflow-hidden p-5 sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-market-bitcoin text-lg text-market-bitcoin-foreground">₿</span><div><h2 className="font-bold">BTC/USDT</h2><p className="text-xs text-muted-foreground">Bitcoin</p></div></div>
            <div className="text-right"><p className="text-xl font-bold">68,432.17</p><p className="text-sm font-semibold text-positive">+1,234.56&nbsp; +1.84%</p></div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span className="rounded-md bg-primary px-2 py-1 text-foreground">1D</span><span>1W</span><span>1M</span><span>3M</span><span>1Y</span><span>All</span></div>
          <div className="mt-3 h-44"><MarketChart /></div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-border rounded-md bg-muted p-3">
            <button onClick={() => openChat("deposit")} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 text-left"><span className="text-2xl">⇩</span><span><strong className="block text-sm">Deposit</strong><small className="text-muted-foreground">Add funds via payment</small></span><ArrowRight size={16} /></button>
            <button onClick={() => openChat("withdraw")} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 text-left"><span className="text-2xl">⇧</span><span><strong className="block text-sm">Withdraw</strong><small className="text-muted-foreground">Get to your account</small></span><ArrowRight size={16} /></button>
          </div>
        </div>
      </section>
      <section className="border-t border-border bg-card py-10">
        <div className="page-container grid gap-8 lg:grid-cols-[260px_1fr]">
          <div><p className="text-xs font-semibold uppercase text-muted-foreground">How it works</p><h2 className="mt-2 text-3xl font-extrabold leading-none">Get started<br />in four simple steps.</h2></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative"><div className="flex items-center gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold">{index + 1}</span><Icon /></div><h3 className="mt-3 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div>
        </div>
        <div className="page-container mt-9 grid gap-4 md:grid-cols-3">{[
          [ShieldCheck, "No funds held", "Coinspace never holds your funds. You remain in control at all times."],
          [Bolt, "Confirmed in minutes", "Fast processing with real-time updates on your deposit and withdrawal."],
          [UserRound, "Support in chat", "Get help anytime from our team directly in the Coinspace chatbot."],
        ].map(([Icon, title, text]) => { const C = Icon as typeof ShieldCheck; return <div key={title as string} className="panel flex gap-4 p-5"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent"><C /></span><div><h3 className="font-bold">{title as string}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text as string}</p></div></div>; })}</div>
      </section>
    </main>
  </CoinspaceShell>;
}