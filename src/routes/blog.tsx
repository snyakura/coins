import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Market News & Analysis — Coinspace" },
      { name: "description", content: "Live forex, crypto and markets news from Coinspace." },
      { property: "og:title", content: "Market News & Analysis — Coinspace" },
      { property: "og:description", content: "Forex, crypto, and market insights from Coinspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogPage,
});

type Article = {
  id: string;
  category: string;
  title: string;
  summary: string;
  image: string;
  url: string;
  source: string;
  datetime: number;
};

const FILTERS = ["All", "Forex", "Crypto", "Markets"];
const PAGE_SIZE = 12;

function timeAgo(unixSeconds: number) {
  const mins = Math.max(1, Math.round((Date.now() / 1000 - unixSeconds) / 60));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function ArticleImage({ src, source, className }: { src: string; source: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-market-dark px-4 text-center text-sm font-bold text-market-dark-foreground ${className ?? ""}`}>
        {source || "Coinspace"}
      </div>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className ?? ""}`} />;
}

function BlogPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/news");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load news.");
      setArticles(data.articles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load news.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filter, query]);

  const featured = useMemo(() => articles.find((a) => a.image) ?? articles[0], [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter(
      (a) =>
        a.id !== featured?.id &&
        (filter === "All" || a.category === filter) &&
        (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)),
    );
  }, [articles, filter, query, featured]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <CoinspaceShell>
      <main className="page-container py-6">
        {/* Featured */}
        {loading ? (
          <div className="panel h-72 animate-pulse bg-muted" />
        ) : featured ? (
          <section className="panel grid overflow-hidden md:grid-cols-2">
            <ArticleImage src={featured.image} source={featured.source} className="h-full min-h-56 w-full md:min-h-72" />
            <div className="flex flex-col justify-center p-5 sm:p-7">
              <p className="text-sm font-semibold uppercase text-muted-foreground">Featured · {featured.category}</p>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-4xl">{featured.title}</h1>
              {featured.summary && <p className="mt-3 line-clamp-3 text-muted-foreground">{featured.summary}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                {featured.source} · {timeAgo(featured.datetime)}
              </p>
              <a href={featured.url} target="_blank" rel="noopener noreferrer" className="mt-5 w-fit">
                <Button variant="dark">
                  Read article <ArrowRight size={16} />
                </Button>
              </a>
            </div>
          </section>
        ) : null}

        {/* Filters */}
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_300px]">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((name) => (
              <Button key={name} size="sm" variant={filter === name ? "primary" : "outline"} onClick={() => setFilter(name)}>
                {name}
              </Button>
            ))}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-full border border-border px-4">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="panel mt-5 flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-negative">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={15} /> Try again
            </Button>
          </div>
        )}

        {/* Grid */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }, (_, i) => <div key={i} className="panel h-72 animate-pulse bg-muted" />)}

          {!loading &&
            visible.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="panel group flex flex-col overflow-hidden">
                <ArticleImage src={a.image} source={a.source} className="h-40 w-full" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex justify-between gap-2 text-[11px] uppercase text-muted-foreground">
                    <span>{a.category}</span>
                    <span>{timeAgo(a.datetime)}</span>
                  </div>
                  <h2 className="mt-2 line-clamp-3 text-base font-extrabold leading-tight">{a.title}</h2>
                  {a.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{a.summary}</p>}
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span className="truncate">{a.source}</span>
                    <ArrowUpRight size={18} className="shrink-0 transition group-hover:text-foreground" />
                  </div>
                </div>
              </a>
            ))}
        </div>

        {!loading && !error && filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">No articles match your search.</p>
        )}

        {!loading && filtered.length > visibleCount && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Load more
            </Button>
          </div>
        )}
      </main>
    </CoinspaceShell>
  );
}