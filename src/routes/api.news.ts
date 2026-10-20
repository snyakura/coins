import { createFileRoute } from "@tanstack/react-router";

const LABELS = { forex: "Forex", crypto: "Crypto", general: "Markets" } as const;
type Cat = keyof typeof LABELS;

type Article = {
  id: string; category: string; title: string; summary: string;
  image: string; url: string; source: string; datetime: number;
};

const cache = new Map<Cat, { at: number; items: Article[] }>();
const TTL = 10 * 60 * 1000;

async function load(cat: Cat): Promise<Article[]> {
  const hit = cache.get(cat);
  if (hit && Date.now() - hit.at < TTL) return hit.items;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");

  const res = await fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=${key}`);
  if (!res.ok) throw new Error(`Finnhub error ${res.status}`);
  const raw = (await res.json()) as any[];

  const items = raw
    .filter((a) => a.headline && a.url)
    .map((a) => ({
      id: String(a.id),
      category: LABELS[cat],
      title: a.headline as string,
      summary: (a.summary as string) ?? "",
      image: (a.image as string) ?? "",
      url: a.url as string,
      source: (a.source as string) ?? "",
      datetime: a.datetime as number,
    }));

  cache.set(cat, { at: Date.now(), items });
  return items;
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async () => {
        const cats = Object.keys(LABELS) as Cat[];
        const results = await Promise.allSettled(cats.map(load));
        results.forEach((r) => r.status === "rejected" && console.error("news:", r.reason?.message));

        const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
        if (!articles.length) {
          return new Response(JSON.stringify({ error: "News is unavailable right now." }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const seen = new Set<string>();
        const unique = articles
          .sort((a, b) => b.datetime - a.datetime)
          .filter((a) => {
            const k = a.title.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, 60);

        return new Response(JSON.stringify({ articles: unique }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});