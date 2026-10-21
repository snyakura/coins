import { Clock3, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type CalEvent = {
  id: string;
  title: string;
  currency: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  time: number;
  forecast: string;
  previous: string;
};

const IMPACT_DOT: Record<string, string> = {
  High: "bg-negative",
  Medium: "bg-amber-400",
  Low: "bg-muted-foreground/40",
  Holiday: "bg-muted-foreground/40",
};
const IMPACTS = ["All", "High", "Medium", "Low"];

const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA");
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: "short", day: "numeric" });

function until(ms: number, now: number) {
  const mins = Math.round((ms - now) / 60000);
  if (mins <= 0) return "";
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days >= 1) return `in ${days}d ${hrs % 24}h`;
  if (hrs >= 1) return `in ${hrs}h ${mins % 60}m`;
  return `in ${mins}m`;
}

function chip(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
  }`;
}

export function MarketCalendar() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [day, setDay] = useState("");
  const [impact, setImpact] = useState("All");
  const [currency, setCurrency] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load the calendar.");
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [load]);

  const days = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => {
      const k = dayKey(e.time);
      if (!map.has(k)) map.set(k, e.time);
    });
    return [...map.entries()].map(([key, ms]) => ({ key, label: fmtDay(ms) }));
  }, [events]);

  useEffect(() => {
    if (!days.length || day) return;
    const today = dayKey(Date.now());
    setDay(days.find((d) => d.key === today)?.key ?? days[0].key);
  }, [days, day]);

  const currencies = useMemo(
        () => ["All", ...Array.from(new Set(events.map((e) => e.currency).filter((c) => c && c !== "All"))).sort()],
    [events],
  );

  const visible = events.filter(
    (e) =>
      dayKey(e.time) === day &&
      (impact === "All" || e.impact === impact) &&
      (currency === "All" || e.currency === currency),
  );

  const next = now ? events.find((e) => e.impact === "High" && e.time > now) : undefined;

  return (
    <section className="panel flex flex-col p-4 lg:h-[600px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">Market calendar</h2>
        <button onClick={load} aria-label="Refresh calendar" className="text-muted-foreground hover:text-foreground">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {next && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs">
          <Clock3 size={14} className="shrink-0" />
          <span className="min-w-0">
            Next high impact: <strong>{next.currency} {next.title}</strong> {until(next.time, now)}
          </span>
        </p>
      )}

      {/* Day tabs */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button key={d.key} onClick={() => setDay(d.key)} className={chip(day === d.key)}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {IMPACTS.map((i) => (
          <button key={i} onClick={() => setImpact(i)} className={chip(impact === i)}>
            {i === "All" ? "All impact" : i}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
        {currencies.map((c) => (
          <button key={c} onClick={() => setCurrency(c)} className={chip(currency === c)}>
            {c === "All" ? "All currencies" : c}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-2 min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {loading && Array.from({ length: 5 }, (_, i) => <div key={i} className="my-3 h-12 animate-pulse rounded-md bg-muted" />)}

        {!loading && error && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-negative">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={15} /> Try again
            </Button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No events match your filters.</p>
        )}

        {!loading &&
          visible.map((e) => (
            <div key={e.id} className="grid grid-cols-[58px_1fr_auto] items-center gap-3 py-3">
              <div className="rounded-md bg-muted p-2 text-center text-xs font-bold">{fmtTime(e.time)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">{e.currency}</span>
                  {e.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Forecast {e.forecast || "—"} · Previous {e.previous || "—"}
                </p>
              </div>
              <div className="text-right">
                <span className={`ml-auto block size-2 rounded-full ${IMPACT_DOT[e.impact]}`} title={`${e.impact} impact`} />
                <small className="text-[11px] text-muted-foreground">{now ? until(e.time, now) : ""}</small>
              </div>
            </div>
          ))}
      </div>

      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        Times shown in your local time. Data from Forex Factory's public weekly calendar feed: forecast and previous values only.
      </p>
    </section>
  );
}