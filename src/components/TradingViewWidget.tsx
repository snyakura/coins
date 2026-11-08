import { memo, useEffect, useRef, useState } from "react";
import { setConsent, useConsent } from "@/components/CookieConsent";

type Props = {
  widget: string; // e.g. "advanced-chart", "ticker-tape"
  config: Record<string, unknown>;
  className?: string;
  lazy?: boolean; // only load when scrolled into view
};

function TradingViewWidgetBase({ widget, config, className, lazy = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const { consent } = useConsent();
  const allowed = consent?.thirdParty === true; // TradingView loads only after the visitor allows third-party content
  const key = JSON.stringify(config);

  useEffect(() => {
    if (!allowed || !lazy || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allowed, lazy, visible]);

  useEffect(() => {
    const el = ref.current;
    if (!allowed || !el || !visible) return;
    el.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";
    el.appendChild(inner);

    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = key;
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [allowed, widget, key, visible]);

  if (!allowed) {
    return (
      <div className={`tradingview-widget-container flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted p-6 text-center ${className ?? ""}`}>
        <p className="text-sm font-semibold">This chart is provided by TradingView</p>
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">
          TradingView may set its own cookies. Allow third-party content to see live charts and market data.
        </p>
        <button type="button" onClick={() => setConsent(true)} className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background">
          Allow and show chart
        </button>
      </div>
    );
  }

  return <div ref={ref} className={`tradingview-widget-container ${className ?? ""}`} />;
}

export const TradingViewWidget = memo(TradingViewWidgetBase);