// ---- Edit the brokers here ------------------------------------------------------------
// Text names are shown as bold wordmarks. To show a real logo instead, put the image in the
// public folder and add it, e.g. { name: "Deriv", logo: "/brokers/deriv.svg" }
const BROKERS: { name: string; logo?: string }[] = [
  { name: "Weltrade" },
  { name: "Deriv" },
  { name: "Binance" },
  { name: "OKX" },
  { name: "Tether USDT" },
];

// Keyframes live here so no other file needs editing
const css = `
.broker-marquee {
  -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
}
.broker-track { animation: broker-scroll 35s linear infinite; }
.broker-marquee:hover .broker-track { animation-play-state: paused; }
@keyframes broker-scroll { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .broker-track { animation: none; } }
`;

function Row({ hidden }: { hidden?: boolean }) {
  // The list is doubled so one row is always wider than the screen
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...BROKERS, ...BROKERS].map((broker, index) => (
        <li key={`${broker.name}-${index}`} className="flex items-center">
          {broker.logo ? (
            <img src={broker.logo} alt={hidden ? "" : broker.name} className="h-7 w-auto opacity-30 grayscale sm:h-8" loading="lazy" />
          ) : (
            <span className="whitespace-nowrap text-xl font-extrabold uppercase tracking-tight text-foreground/25 sm:text-2xl">{broker.name}</span>
          )}
          <span className="mx-8 size-1 shrink-0 rounded-full bg-foreground/15 sm:mx-12" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

/** "Trusted brokers" strip: a plain label with thin lines beside it and a slowly scrolling, faint row of names. */
export function BrokerMarquee() {
  return (
    <section aria-label="Trusted brokers" className="pb-10 pt-4 sm:pb-12 sm:pt-6">
      <style>{css}</style>
      <div className="page-container">
        <div className="flex items-center gap-5">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="text-center text-xs font-medium text-muted-foreground sm:text-sm">Trusted brokers worldwide</span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
      </div>
      <div className="broker-marquee mt-8 overflow-hidden">
        <div className="broker-track flex w-max items-center">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}