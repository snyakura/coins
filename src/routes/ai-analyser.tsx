import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Clock3, Info, RefreshCw, Sparkles } from "lucide-react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { MarketChart } from "@/components/MarketChart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ai-analyser")({
  head: () => ({ meta: [
    { title: "AI Chart Analyser — Coinspace" }, { name: "description", content: "Upload a market chart and review Coinspace key levels and reasoning." },
    { property: "og:title", content: "AI Chart Analyser — Coinspace" }, { property: "og:description", content: "Review key chart levels and market reasoning." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: AiAnalyserPage,
});

function AiAnalyserPage() {
  return <CoinspaceShell><main className="page-container py-8">
    <h1 className="text-4xl font-extrabold sm:text-5xl">Analyse any chart with AI</h1><p className="mt-2 text-lg text-muted-foreground">Upload a screenshot and get key levels and reasoning.</p>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_.9fr]">
      <section className="panel overflow-hidden"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-positive text-background">✓</span><div className="min-w-0"><p className="truncate text-sm font-bold">chart-eurusd.png</p><p className="text-[11px] text-muted-foreground">Image uploaded successfully</p></div></div><div className="flex gap-2"><Button variant="outline" size="sm"><RefreshCw size={15}/> <span className="hidden sm:inline">Replace image</span></Button><Button variant="dark" size="sm"><Sparkles size={15}/> Analyse</Button></div></div>
        <div className="p-4"><p className="text-xs font-semibold">🇪🇺EUR/USD · 4h · FXCM <span className="ml-2 text-positive">O1.0873&nbsp; H1.0881&nbsp; L1.0869&nbsp; C1.0878&nbsp; +0.0005 (+0.05%)</span></p><div className="relative mt-3 h-[300px]"><MarketChart candlesticks /><div className="absolute left-0 right-0 top-[34%] border-t border-dashed border-negative"/><span className="absolute right-2 top-[27%] text-xs font-bold text-negative">Resistance 1.0920</span><div className="absolute bottom-[24%] left-0 right-0 border-t border-dashed border-positive"/><span className="absolute bottom-[16%] right-2 text-xs font-bold text-positive">Support 1.0815</span></div></div>
      </section>
      <aside className="panel p-4"><div className="flex justify-between"><h2 className="text-lg font-bold">AI Analysis Result</h2><span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 size={13}/> Analysed just now</span></div><div className="mt-6 grid grid-cols-2 gap-4"><div className="grid aspect-square place-items-center rounded-full border-[9px] border-positive border-r-border"><div className="text-center"><strong className="block text-2xl">Bullish<br/>78%</strong><small className="text-muted-foreground">confidence</small></div></div><p className="rounded-md bg-positive-soft p-3 text-xs leading-5">Price is approaching key resistance at 1.0920. A breakout above this level could open the way to 1.1000. Key support remains at 1.0815.</p></div>
        <div className="mt-4 divide-y divide-border border-y border-border">{[[ArrowUp,"Resistance","Key resistance level","1.0920"],[ArrowDown,"Support","Key support level","1.0815"]].map(([Icon,title,text,value]) => { const C=Icon as typeof ArrowUp; return <div key={title as string} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-4"><span className="grid size-8 place-items-center rounded-full bg-muted"><C size={16}/></span><div><p className="text-sm font-bold">{title as string}</p><p className="text-[11px] text-muted-foreground">{text as string}</p></div><strong className="text-lg">{value as string}</strong></div>})}</div>
        <div className="mt-4 flex gap-3 rounded-md bg-warning-soft p-3"><Info className="shrink-0" size={18}/><div><p className="text-sm font-bold">Not financial advice</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This analysis is for informational purposes only and should not be considered financial advice.</p></div></div>
      </aside>
    </div>
    <div className="mt-7 flex justify-between"><h2 className="text-lg font-bold">Recent analyses</h2><button className="text-sm font-semibold">View all →</button></div><div className="mt-3 grid gap-3 md:grid-cols-3">{[["EUR/USD 4H","Bullish 78%"],["XAU/USD 1H","Bullish 65%"],["BTC/USDT 1D","Bullish 72%"]].map(([name,result])=><div key={name} className="panel grid grid-cols-[130px_1fr] items-center gap-3 p-3"><MarketChart compact/><div><p className="font-bold">{name}</p><p className="text-xs text-muted-foreground">Analysed recently</p><span className="mt-2 inline-block rounded-full bg-positive-soft px-2 py-1 text-xs text-positive">{result}</span></div></div>)}</div>
  </main></CoinspaceShell>;
}