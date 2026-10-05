import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { Button } from "@/components/ui/button";
import fedDollar from "@/assets/fed-dollar.jpg";
import goldBars from "@/assets/gold-bars.jpg";

export const Route = createFileRoute("/blog")({
  head: () => ({ meta: [
    { title: "Market News & Analysis — Coinspace" }, { name: "description", content: "Read Coinspace forex, crypto, and markets news and analysis." },
    { property: "og:title", content: "Market News & Analysis — Coinspace" }, { property: "og:description", content: "Forex, crypto, and market insights from Coinspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: BlogPage,
});

const articles = [
  { category: "Forex News", date: "May 2, 2024", title: "Fed holds rates steady", text: "The Fed keeps interest rates unchanged, signaling a patient approach as inflation shows further signs of cooling.", image: fedDollar, read: "3 min read" },
  { category: "Markets", date: "May 1, 2024", title: "Gold tests record high", text: "Gold climbs to a new record as safe-haven demand grows amid global uncertainty and rising geopolitical tensions.", image: goldBars, read: "4 min read" },
  { category: "Analysis", date: "Apr 30, 2024", title: "EUR/USD eyes 1.1000 ahead of NFP", text: "The euro holds gains as traders position for Friday's US jobs data, with 1.1000 in focus.", image: "chart", read: "5 min read" },
];

function BlogPage() {
  const [filter, setFilter] = useState("All"); const [query, setQuery] = useState("");
  const visible = useMemo(() => articles.filter((a) => (filter === "All" || a.category.toLowerCase().includes(filter.toLowerCase().replace(" news", ""))) && a.title.toLowerCase().includes(query.toLowerCase())), [filter, query]);
  return <CoinspaceShell><main className="page-container py-6">
    <section className="panel grid overflow-hidden md:grid-cols-2"><img src={fedDollar} width={1280} height={720} alt="US dollar and Federal Reserve building" className="h-full min-h-64 w-full object-cover"/><div className="flex flex-col justify-center p-7"><p className="text-sm font-semibold uppercase text-muted-foreground">Featured</p><h1 className="mt-3 text-4xl font-extrabold leading-none sm:text-5xl">Dollar steadies<br/>ahead of NFP</h1><p className="mt-3 text-muted-foreground">Traders brace for Friday's jobs data. 5 min read</p><Button variant="dark" className="mt-5 w-fit">Read article <ArrowRight size={16}/></Button></div></section>
    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_300px]"><div className="flex flex-wrap gap-2">{["All","Forex News","Crypto","Guides"].map((name)=><Button key={name} size="sm" variant={filter===name?"primary":"outline"} onClick={()=>setFilter(name)}>{name}</Button>)}</div><label className="flex h-10 items-center gap-2 rounded-full border border-border px-4"><Search size={17}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search articles..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]"><div className="grid gap-4 md:grid-cols-3">{visible.map((article)=><article key={article.title} className="panel overflow-hidden"><div className="h-36 bg-market-dark">{article.image === "chart" ? <div className="flex h-full items-center justify-center text-center text-sm font-bold text-market-dark-foreground">EURUSD&nbsp;&nbsp; <span className="text-positive">+0.42%</span><br/>GBPUSD&nbsp;&nbsp; <span className="text-positive">+0.28%</span></div> : <img src={article.image} loading="lazy" width={640} height={420} alt="" className="h-full w-full object-cover"/>}</div><div className="p-4"><div className="flex justify-between text-[11px] uppercase text-muted-foreground"><span>{article.category}</span><span>{article.date}</span></div><h2 className="mt-2 text-lg font-extrabold leading-tight">{article.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{article.text}</p><div className="mt-5 flex justify-between text-xs text-muted-foreground"><span>{article.read}</span><ArrowRight size={18}/></div></div></article>)}</div>
      <aside className="panel h-fit p-4"><div className="flex justify-between"><h2 className="font-bold">Upcoming events</h2><button className="text-xs text-muted-foreground">View all →</button></div><div className="mt-3 divide-y divide-border">{[["FRI","May 3","13:30","US Non-Farm Payrolls"],["WED","May 8","13:30","US CPI"],["THU","May 9","12:45","ECB Rate Decision"]].map(([day,date,time,name])=><div key={name} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 py-4"><div className="rounded-md bg-muted p-2 text-center text-xs font-bold">{day}<br/>{date}</div><div><strong className="text-sm">{time}</strong><p className="text-sm">{name}</p><small className="text-muted-foreground">2d 4h 12m</small></div><span className="size-2 rounded-full bg-negative" title="High impact"/></div>)}</div></aside>
    </div>
  </main></CoinspaceShell>;
}