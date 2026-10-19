import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bolt, CreditCard, FileText, Headset, Send, ShieldCheck, UserRound } from "lucide-react";
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
  // Phones show these as a 2 x 2 grid with thin dividers. From tablets up it is three in a row and the fourth is hidden.
  const benefits = [
    { icon: ShieldCheck, title: "Non-custodial", text: "You stay in control", extra: "border-r border-b pr-4 sm:border-b-0 sm:pr-0" },
    { icon: BarChart3, title: "Global markets", text: "Crypto and forex", extra: "border-b pl-5 sm:border-b-0 sm:border-r sm:pl-0" },
    { icon: Bolt, title: "Fast and secure", text: "Built for everyone", extra: "border-r pr-4 sm:border-r-0 sm:pr-0" },
    { icon: Headset, title: "Chat support", text: "Help in the chat", extra: "pl-5 sm:hidden" },
  ];
  const steps = [
    { icon: UserRound, title: "Create your account", text: "Sign up in minutes and verify your details." },
    { icon: CreditCard, title: "Tap Deposit and send payment", text: "Choose your preferred payment method." },
    { icon: FileText, title: "Send proof and we confirm", text: "Upload your payment proof and we’ll confirm quickly." },
    { icon: Send, title: "Withdraw to your account anytime", text: "Funds go directly to your account." },
  ];
  return <CoinspaceShell>
    <main>
      {/* Hero. It fills the whole first screen (4.5rem / 5rem is the header height), so the brokers strip
          only appears once you scroll. The content sits together in the middle of that space. */}
      <section className="flex min-h-[calc(100svh-4.5rem)] items-center overflow-x-clip sm:min-h-[calc(100svh-5rem)]">
        <div className="page-container grid items-start gap-8 py-10 sm:py-16 xl:grid-cols-[0.85fr_1.15fr] xl:gap-6">
          {/* Text block. xl:pt-28 lowers it on large screens only. */}
          <div className="xl:pt-28">
            <span className="block text-xs font-semibold sm:text-sm">Trade global markets. On your terms.</span>

            {/* Bigger and bolder on phones. The size scales with the screen so "Buy and sell" always fits on one line. */}
            <h1 className="mt-4 max-w-[800px] text-[clamp(2.6rem,12.5vw,3.5rem)] font-black leading-[1.02] [-webkit-text-stroke:2px_currentColor] sm:mt-5 sm:whitespace-nowrap sm:text-6xl sm:font-extrabold sm:leading-[.98] sm:[-webkit-text-stroke:1.5px_currentColor] lg:text-7xl">
              Buy and sell<br />crypto. Fast.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Deposit, trade and withdraw. Coinspace never holds your funds.
            </p>

            {/* Buttons: stacked and full width on phones with room around them, side by side from tablets up */}
            <div className="mt-8 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button variant="dark" className="w-full sm:w-auto sm:min-w-40" onClick={() => openChat("deposit")}>Deposit <ArrowRight size={17} /></Button>
              <Button variant="outline" className="w-full hover:border-primary hover:bg-primary sm:w-auto sm:min-w-40" onClick={() => openChat("withdraw")}>Withdraw <ArrowRight size={17} /></Button>
            </div>

            {/* Benefits: 2 x 2 on phones, three in a row with dividers from tablets up */}
            <ul className="mt-8 grid grid-cols-2 sm:mt-10 sm:max-w-2xl sm:grid-cols-3 sm:gap-4">
              {benefits.map(({ icon: Icon, title, text, extra }) => (
                <li key={title} className={`flex items-center gap-3 border-border py-4 sm:py-0 ${extra}`}>
                  <Icon className="size-6 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight sm:text-xs">{title}</p>
                    <p className="mt-0.5 text-xs leading-tight text-muted-foreground sm:text-[11px]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Phone image: only shown when it fits on the right, never below the text */}
          <div className="relative -mt-12 hidden items-center justify-end xl:flex">
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