import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bolt, CreditCard, FileText, Send, ShieldCheck, UserRound } from "lucide-react";
import { CoinspaceShell, useTransactionActions } from "@/components/CoinspaceShell";
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
              className="pointer-events-none h-auto w-[95%] max-w-none select-none mix-blend-multiply drop-shadow-[0_30px_40px_rgba(0,0,0,0.18)]"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </section>
    </main>
  </CoinspaceShell>;
}