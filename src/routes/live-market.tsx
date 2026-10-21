import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { MarketCalendar } from "@/components/MarketCalendar";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/live-market")({
  head: () => ({
    meta: [
      { title: "Live Markets — Coinspace" },
      { name: "description", content: "Live forex, metals, crypto and index charts with the weekly economic calendar." },
      { property: "og:title", content: "Live Markets — Coinspace" },
      { property: "og:description", content: "Live charts, prices and the economic calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveMarketPage,
});

const GROUPS: Record<string, [string, string][]> = {
  Forex: [
    ["FX:EURUSD", "EUR/USD"], ["FX:GBPUSD", "GBP/USD"], ["FX:USDJPY", "USD/JPY"], ["FX:AUDUSD", "AUD/USD"],
    ["FX:USDCAD", "USD/CAD"], ["FX:USDCHF", "USD/CHF"], ["FX:NZDUSD", "NZD/USD"],
  ],
  Metals: [["TVC:GOLD", "Gold"], ["TVC:SILVER", "Silver"]],
  Crypto: [["BINANCE:BTCUSDT", "BTC/USDT"], ["BINANCE:ETHUSDT", "ETH/USDT"], ["BINANCE:SOLUSDT", "SOL/USDT"]],
  Indices: [["TVC:DXY", "US Dollar Index"], ["FOREXCOM:SPXUSD", "S&P 500"], ["FOREXCOM:NSXUSD", "Nasdaq 100"], ["TVC:DJI", "Dow 30"]],
};

const WATCHLIST = ["FX:EURUSD", "FX:GBPUSD", "FX:USDJPY", "TVC:GOLD", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "TVC:DXY", "FOREXCOM:SPXUSD"];

const TICKER = [
  ["FX:EURUSD", "EUR/USD"], ["FX:GBPUSD", "GBP/USD"], ["FX:USDJPY", "USD/JPY"], ["TVC:GOLD", "Gold"],
  ["BINANCE:BTCUSDT", "BTC"], ["BINANCE:ETHUSDT", "ETH"], ["TVC:DXY", "DXY"],
].map(([proName, title]) => ({ proName, title }));

function pill(active: boolean) {
  return `shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
    active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
  }`;
}

function LiveMarketPage() {
  const [group, setGroup] = useState("Forex");
  const [symbol, setSymbol] = useState("FX:EURUSD");
  const [tz, setTz] = useState<string | null>(null);

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC");
  }, []);

  function pickGroup(name: string) {
    setGroup(name);
    setSymbol(GROUPS[name][0][0]);
  }

  return (
    <CoinspaceShell>
      <main className="page-container py-6 sm:py-8">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Live Markets</h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">Real-time charts, prices and the week's economic events.</p>

        {/* Ticker tape */}
        <div className="panel mt-5 h-[76px] overflow-hidden">
          {tz && (
            <TradingViewWidget
              widget="ticker-tape"
              className="h-full w-full"
              config={{ symbols: TICKER, showSymbolLogo: false, colorTheme: "light", isTransparent: true, displayMode: "adaptive", locale: "en" }}
            />
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_.9fr]">
          {/* Main chart */}
          <section className="panel flex flex-col overflow-hidden p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Object.keys(GROUPS).map((g) => (
                <button key={g} onClick={() => pickGroup(g)} className={pill(group === g)}>
                  {g}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {GROUPS[group].map(([sym, label]) => (
                <button
                  key={sym}
                  onClick={() => setSymbol(sym)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    symbol === sym ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="h-[480px] sm:h-[560px]">
              {tz && (
                <TradingViewWidget
                  widget="advanced-chart"
                  className="h-full w-full"
                  config={{
                    autosize: true,
                    symbol,
                    interval: "60",
                    timezone: tz,
                    theme: "light",
                    style: "1",
                    locale: "en",
                    allow_symbol_change: false,
                    hide_side_toolbar: false,
                    withdateranges: true,
                    details: false,
                    hotlist: false,
                    calendar: false,
                    backgroundColor: "#ffffff",
                    gridColor: "rgba(0, 0, 0, 0.06)",
                    support_host: "https://www.tradingview.com",
                  }}
                />
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Charts by{" "}
              <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="underline">
                TradingView
              </a>
              . Some prices may be delayed.
            </p>
          </section>

          <MarketCalendar />
        </div>

        {/* Watchlist */}
        <h2 className="mt-8 text-xl font-extrabold">Watchlist</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WATCHLIST.map((sym) => (
            <div key={sym} className="panel h-[220px] overflow-hidden">
              {tz && (
                <TradingViewWidget
                  widget="mini-symbol-overview"
                  lazy
                  className="h-full w-full"
                  config={{
                    symbol: sym,
                    width: "100%",
                    height: "100%",
                    locale: "en",
                    dateRange: "1D",
                    colorTheme: "light",
                    isTransparent: true,
                    autosize: true,
                    largeChartUrl: "",
                    chartOnly: false,
                    noTimeScale: false,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Heatmap + AI card */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_.9fr]">
          <section className="panel h-[420px] overflow-hidden p-2">
            {tz && (
              <TradingViewWidget
                widget="forex-heat-map"
                lazy
                className="h-full w-full"
                config={{
                  width: "100%",
                  height: "100%",
                  currencies: ["EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"],
                  isTransparent: true,
                  colorTheme: "light",
                  locale: "en",
                }}
              />
            )}
          </section>

          <section className="flex flex-col justify-center rounded-2xl bg-[#FFCB05] p-6 text-black">
            <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">Analyse any chart with AI</h2>
            <p className="mt-2 text-sm">Upload a screenshot and get key levels and reasoning in seconds.</p>
            <Link to="/ai-analyser" className="mt-5 w-fit">
              <Button variant="dark">
                Get started <ArrowRight size={16} />
              </Button>
            </Link>
          </section>
        </div>
      </main>
    </CoinspaceShell>
  );
}