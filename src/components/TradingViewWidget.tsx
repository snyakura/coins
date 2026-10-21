import { memo, useEffect, useRef, useState } from "react";

type Props = {
  widget: string; // e.g. "advanced-chart", "ticker-tape"
  config: Record<string, unknown>;
  className?: string;
  lazy?: boolean; // only load when scrolled into view
};

function TradingViewWidgetBase({ widget, config, className, lazy = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const key = JSON.stringify(config);

  useEffect(() => {
    if (!lazy || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, visible]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !visible) return;
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
  }, [widget, key, visible]);

  return <div ref={ref} className={`tradingview-widget-container ${className ?? ""}`} />;
}

export const TradingViewWidget = memo(TradingViewWidgetBase);