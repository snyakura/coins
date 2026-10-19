import { ArrowRight, Plus, X } from "lucide-react";
import { useId, useState, type MouseEvent } from "react";
import { CoinspaceShell as _unused, useTransactionActions } from "@/components/CoinspaceShell";
import { Button } from "@/components/ui/button";

// ---- Edit the questions and answers here -------------------------------------------------
const FAQS = [
  {
    q: "What can I do with Coinspace?",
    a: "Coinspace lets you deposit and withdraw for forex and crypto trading through simple chat steps. You can use USDT, Weltrade, Deriv or other crypto.",
  },
  {
    q: "Does Coinspace hold my funds?",
    a: "No. Coinspace never holds your funds, so you stay in control at all times. Only trade with money you can afford to lose, because markets move fast and trading carries risk.",
  },
  {
    q: "How do I make a deposit?",
    a: "Tap Deposit and choose your payment method: USDT, Weltrade, Deriv or other crypto. Follow the chat steps, send your payment, then upload your proof of payment so we can confirm it.",
  },
  {
    q: "Which payment methods and networks can I use?",
    a: "For USDT you can choose the Polygon, Optos or TRC20 network. You can also deposit to Weltrade (with your user ID) or Deriv (with your nickname), or pay with another crypto.",
  },
  {
    q: "Do I need to send proof of payment?",
    a: "Yes. After every transaction you upload your proof of payment in the chat, and we confirm it quickly. Having it ready makes the process faster.",
  },
  {
    q: "How do I withdraw?",
    a: "Tap Withdraw and choose how you want to be paid, for example USDT through Binance ID, OKX ID or a TRC20, Optos or Polygon address. Follow the chat steps and your funds go directly to your account.",
  },
];

/** Smooth-scrolls to the contact details in the footer (the footer is on every page). */
function scrollToContact(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById("contact");
  if (!target) return; // no footer found: the plain #contact link still works
  event.preventDefault();
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

function FaqSection() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0); // first question starts open

  return (
    <section aria-labelledby={`${baseId}-title`} className="py-16 sm:py-20">
      <div className="page-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id={`${baseId}-title`} className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">These are the questions we hear most often.</p>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:mt-14 lg:grid-cols-[1fr_340px] lg:gap-12">
          <ul className="border-t border-border">
            {FAQS.map((item, index) => {
              const isOpen = open === index;
              const buttonId = `${baseId}-q-${index}`;
              const panelId = `${baseId}-a-${index}`;
              return (
                <li key={item.q} className="border-b border-border">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    >
                      {item.q}
                      {isOpen ? <X size={18} className="shrink-0" aria-hidden="true" /> : <Plus size={18} className="shrink-0" aria-hidden="true" />}
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-5 pr-10 text-sm leading-6 text-muted-foreground">{item.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-2xl bg-muted px-6 py-10 text-center lg:sticky lg:top-24">
            <h3 className="text-xl font-extrabold leading-snug">Don&rsquo;t see the answer you need?</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">That&rsquo;s ok. Just drop us a message and we will get back to you as soon as we can.</p>
            <Button asChild variant="dark" className="mt-6 hover:bg-primary hover:text-primary-foreground">
              <a href="#contact" onClick={scrollToContact}>Contact us</a>
            </Button>
          </aside>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const openChat = useTransactionActions();
  return (
    <section aria-labelledby="final-cta" className="page-container pb-4 sm:pb-6">
      <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16 lg:px-16">
        {/* The logo's open ring, cropped and faint */}
        <svg viewBox="0 0 50 50" aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-16 size-60 text-primary/20 sm:-bottom-32 sm:-right-24 sm:size-[26rem]">
          <circle cx="25" cy="25" r="19" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="92 28" transform="rotate(-35 25 25)" />
        </svg>
        <div className="relative max-w-2xl">
          <h2 id="final-cta" className="text-balance text-3xl font-extrabold leading-[1.05] sm:text-4xl lg:text-5xl">
            Take control of your trading starting today.
          </h2>
          <p className="mt-4 max-w-xl text-balance text-base leading-7 text-background/70 sm:text-lg">
            Deposit, trade and withdraw in simple chat steps. Coinspace never holds your funds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" className="min-w-40" onClick={() => openChat("deposit")}>
              Deposit <ArrowRight size={17} />
            </Button>
            <Button
              variant="outline"
              className="min-w-40 border-background/40 bg-transparent text-background hover:border-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => openChat("withdraw")}
            >
              Withdraw <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** FAQ list plus the black call-to-action card. Placed on the home page, just above the footer. */
export function FaqCta() {
  return (
    <>
      <FaqSection />
      <FinalCta />
    </>
  );
}