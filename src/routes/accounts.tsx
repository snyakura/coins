import { createFileRoute } from '@tanstack/react-router'

import { useRef, useState } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/lib/links";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Create your trading account — Coinspace" },
      { name: "description", content: "Choose a broker and follow the steps to open your Weltrade or Deriv trading account." },
    ],
  }),
  component: AccountsPage,
});

type Broker = {
  id: "weltrade" | "deriv";
  name: string;
  logo: string;
  tagline: string;
  cta: string;
  link: string;
  sections: { title: string; steps: string[] }[];
  doneCta?: boolean;
};

const BROKERS: Broker[] = [
  {
    id: "weltrade",
    name: "Weltrade",
    logo: LINKS.weltradeLogo,
    tagline: "To trade synthetics too, create your Weltrade account. Leverage 1:10k on synthetics.",
    cta: "Create Weltrade account",
    link: LINKS.weltrade,
    sections: [
      {
        title: "Get set up",
        steps: [
          "Tap the button above to create your Weltrade account with our link.",
          "Complete your details and get verified.",
        ],
      },
    ],
  },
  {
    id: "deriv",
    name: "Deriv",
    logo: LINKS.derivLogo,
    tagline: "For now, create your trading account with our Deriv link and follow the steps below.",
    cta: "Create Deriv account",
    link: LINKS.deriv,
    doneCta: true,
    sections: [
      {
        title: "Step 1 — Create your account",
        steps: [
          "Open the Deriv link above and sign up with your email address.",
          "Go to your Gmail. You should have an email from Deriv that says “One more step to create your account…”.",
          "Click “Verify my email”, choose country Zimbabwe, then create a password you will remember and screenshot it.",
          "Click “Start trading”, then send us the screenshot and say “done”.",
        ],
      },
      {
        title: "Step 2 — After step 1",
        steps: [
          "Click the link and log in with the email address and password you created.",
          "Click log in. It takes you to the demo page. Click the three lines (top left corner), then click Traders Hub.",
          "Click the box on the top left that says Demo. When the menu pops up, click Real, then Get Deriv account, choose USD for currency and click Next.",
          "Enter your details exactly as they are on your ID, not nicknames.",
          "First line of address: your residential address (e.g. 5976 Westlea). Second line: your city. Choose your province, fill in your correct date of birth, then click Next.",
          "Tick “I am not a PEP” (not a political person), then create your account.",
          "When it asks if you wish to transfer funds, say “Maybe later”.",
          "Finally, click the drop-down arrow next to the 0.0, screenshot what you see, send us the screenshot and say “done”.",
        ],
      },
    ],
  },
];

function AccountsPage() {
  const [pick, setPick] = useState<Broker["id"] | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const broker = BROKERS.find((b) => b.id === pick) ?? null;

  const choose = (id: Broker["id"]) => {
    setPick(id);
    window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <CoinspaceShell>
      <main className="page-container py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Trading account</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">Choose your broker</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Pick where you want to trade. We’ll show you exactly how to create and verify your account, step by step.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {BROKERS.map((b) => {
            const active = pick === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => choose(b.id)}
                className={`panel relative flex flex-col overflow-hidden p-0 text-left transition-shadow ${active ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/40"}`}
              >
                <div className="flex h-36 items-center justify-center bg-white px-6">
                  <img src={b.logo} alt={b.name} className="max-h-24 w-full object-contain" />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold">{b.name}</h2>
                    <span className={`grid size-7 place-items-center rounded-full border ${active ? "border-foreground bg-foreground text-background" : "border-border text-transparent"}`}>
                      <Check size={15} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{b.tagline}</p>
                  <span className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                    {active ? "Selected" : `Choose ${b.name}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div ref={guideRef} className="mt-8 scroll-mt-6">
          {broker ? (
            <Guide key={broker.id} broker={broker} />
          ) : (
            <p className="panel px-5 py-8 text-center text-sm text-muted-foreground">Select a broker above to see how to sign up.</p>
          )}
        </div>

        <section className="panel mt-8 flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex h-20 w-44 shrink-0 items-center justify-center rounded-xl bg-white px-3">
            <img src={LINKS.tfmLogo} alt="The Forex Mafia" className="max-h-14 w-full object-contain" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">In cooperation with The Forex Mafia</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Join our WhatsApp channel for updates from The Forex Mafia.</p>
          </div>
          <Button asChild variant="dark">
            <a href={LINKS.tfmChannel} target="_blank" rel="noopener noreferrer">Join the channel <ArrowUpRight size={17} /></a>
          </Button>
        </section>
      </main>
    </CoinspaceShell>
  );
}

function Guide({ broker }: { broker: Broker }) {
  return (
    <section className="panel anim-rise p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sign up on</p>
          <h2 className="text-2xl font-extrabold">{broker.name}</h2>
        </div>
        <Button asChild variant="primary">
          <a href={broker.link} target="_blank" rel="noopener noreferrer">{broker.cta} <ArrowUpRight size={17} /></a>
        </Button>
      </div>

      <div className="mt-6 grid gap-8">
        {broker.sections.map((s) => (
          <div key={s.title}>
            <h3 className="text-sm font-extrabold uppercase tracking-[0.1em]">{s.title}</h3>
            <ol className="mt-4 grid gap-4">
              {s.steps.map((text, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold">{i + 1}</span>
                  <p className="pt-1 text-sm leading-6">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {broker.doneCta && (
        <div className="mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Finished a step? Send us your screenshot and say “done”.</p>
          <Button asChild variant="dark">
            <a href={LINKS.whatsappDone} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Send screenshot on WhatsApp</a>
          </Button>
        </div>
      )}
    </section>
  );
}