import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bolt, CreditCard, FileText, Send, ShieldCheck, UserRound } from "lucide-react";
import { BrokerMarquee } from "@/components/BrokerMarquee";
import { CoinspaceShell, useTransactionActions } from "@/components/CoinspaceShell";
import { FaqCta } from "@/components/FaqCta";
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

// Page the "Get started" button opens. Change this one line to point somewhere else.
const GET_STARTED_PAGE = "/live-market" as const;

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
      <section className="flex min-h-[calc(100svh-4rem)] items-center overflow-x-clip">
        <div className="page-container grid items-center gap-8 py-12 sm:py-16 xl:grid-cols-[0.85fr_1.15fr] xl:gap-6">
          <div>
            <span className="text-xs font-semibold sm:text-sm">Trade global markets. On your terms.</span>
            <h1 className="mt-5 max-w-[800px] text-5xl font-extrabold leading-[.98] [-webkit-text-stroke:1.5px_currentColor] sm:whitespace-nowrap sm:text-6xl lg:text-7xl">Buy and sell<br />crypto. Fast.</h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">Deposit, trade and withdraw. Coinspace never holds your funds.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="dark" className="min-w-40" onClick={() => openChat("deposit")}>Deposit <ArrowRight size={17} /></Button>
              <Button variant="outline" className="min-w-40 hover:border-primary hover:bg-primary" onClick={() => openChat("withdraw")}>Withdraw <ArrowRight size={17} /></Button>
            </div>
            <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
              {benefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3 border-r border-border last:border-0"><Icon className="shrink-0" /><div><p className="text-xs font-bold">{title}</p><p className="text-[11px] text-muted-foreground">{text}</p></div></div>)}
            </div>
          </div>

          {/* Phone image: only shown when it fits on the right, never below the text */}
          <div className="relative hidden items-center justify-end xl:flex">
         <img
  src="/phone-hero-3d.svg"
  alt="Coinspace app preview"
  className="pointer-events-none h-auto w-[112%] max-w-none select-none mix-blend-multiply drop-shadow-[0_30px_40px_rgba(0,0,0,0.18)] xl:translate-x-20"
  loading="eager"
  decoding="async"
/>
          </div>
        </div>
      </section>

      {/* Trusted brokers strip, right after the hero */}
      <BrokerMarquee />

      <section className="bg-card py-10">
        <div className="page-container grid gap-8 lg:grid-cols-[260px_1fr]">
          <div><p className="text-xs font-semibold uppercase text-muted-foreground">How it works</p><h2 className="mt-2 text-3xl font-extrabold leading-none">Get started<br />in four simple steps.</h2><Button asChild variant="primary" className="mt-5"><Link to={GET_STARTED_PAGE}>Get started <ArrowRight size={17} /></Link></Button></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map(({ icon: Icon, title, text }, index) => <div key={title} className="relative"><div className="flex items-center gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold">{index + 1}</span><Icon /></div><h3 className="mt-3 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</div>
        </div>
        <div className="page-container mt-9 grid gap-4 md:grid-cols-3">{[
          [ShieldCheck, "No funds held", "Coinspace never holds your funds. You remain in control at all times."],
          [Bolt, "Confirmed in minutes", "Fast processing with real-time updates on your deposit and withdrawal."],
          [UserRound, "Support in chat", "Get help anytime from our team directly in the Coinspace chatbot."],
        ].map(([Icon, title, text]) => { const C = Icon as typeof ShieldCheck; return <div key={title as string} className="panel flex gap-4 p-5"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent"><C /></span><div><h3 className="font-bold">{title as string}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text as string}</p></div></div>; })}</div>
      </section>

      {/* FAQ and call-to-action card, just above the footer */}
      <FaqCta />
    </main>
  </CoinspaceShell>;
}