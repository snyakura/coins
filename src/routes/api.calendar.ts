import { createFileRoute } from "@tanstack/react-router";

const FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

type CalEvent = {
  id: string;
  title: string;
  currency: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  time: number; // unix milliseconds
  forecast: string;
  previous: string;
};

let cache: { at: number; items: CalEvent[] } | null = null;
const TTL = 15 * 60 * 1000; // 15 minutes, keeps us well inside the feed's rate limit

async function loadCalendar(): Promise<CalEvent[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.items;

  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Coinspace/1.0)", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Calendar feed ${res.status}`);
    const raw = (await res.json()) as any[];

    const items = raw
      .filter((e) => e?.title && e?.date)
      .map((e) => {
        const impact = ["High", "Medium", "Low"].includes(e.impact) ? e.impact : "Holiday";
        return {
          id: `${e.date}-${e.country}-${e.title}`,
          title: String(e.title),
          currency: String(e.country ?? ""),
          impact,
          time: Date.parse(e.date),
          forecast: String(e.forecast ?? ""),
          previous: String(e.previous ?? ""),
        } as CalEvent;
      })
      .filter((e) => !Number.isNaN(e.time))
      .sort((a, b) => a.time - b.time);

    cache = { at: Date.now(), items };
    return items;
  } catch (e) {
    if (cache) return cache.items; // serve the last good copy if the feed is down or rate limited
    throw e;
  }
}

export const Route = createFileRoute("/api/calendar")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const events = await loadCalendar();
          return new Response(JSON.stringify({ events }), {
            headers: {
              "Content-Type": "application/json",
              // lets Vercel's CDN cache the answer so the feed is called rarely
              "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
            },
          });
        } catch (e) {
          console.error("calendar:", e);
          return new Response(JSON.stringify({ error: "Calendar is unavailable right now." }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});