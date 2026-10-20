import express from "express";
import { callModel, type ChatMsg } from "../src/lib/ai.server";
import { ANALYSE_SYSTEM, CHAT_SYSTEM, TRANSACTION_SYSTEM } from "../src/lib/ai-prompts";

const app = express();
app.use(express.json({ limit: "10mb" }));

/* ---------- News ---------- */
const LABELS = { forex: "Forex", crypto: "Crypto", general: "Markets" } as const;
type Cat = keyof typeof LABELS;
const cache = new Map<Cat, { at: number; items: any[] }>();
const TTL = 10 * 60 * 1000;

async function loadNews(cat: Cat) {
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
      title: a.headline,
      summary: a.summary ?? "",
      image: a.image ?? "",
      url: a.url,
      source: a.source ?? "",
      datetime: a.datetime,
    }));

  cache.set(cat, { at: Date.now(), items });
  return items;
}

app.get("/api/news", async (_req, res) => {
  const cats = Object.keys(LABELS) as Cat[];
  const results = await Promise.allSettled(cats.map(loadNews));
  results.forEach((r) => r.status === "rejected" && console.error("news:", r.reason.message));

  const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!articles.length) return res.status(502).json({ error: "News is unavailable right now." });

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

  res.json({ articles: unique });
});

/* ---------- AI ---------- */
app.post("/api/ai", async (req, res) => {
  try {
    const body = req.body ?? {};
    const mode = body.mode as "chat" | "analyse" | "transaction";
    const messages: ChatMsg[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const image = body.image as { mediaType: string; data: string } | undefined;
    if (image) {
      if (!/^image\/(png|jpeg|webp)$/.test(image.mediaType)) return res.status(400).json({ error: "Unsupported image type" });
      if (image.data.length > 7_000_000) return res.status(413).json({ error: "Image is too large" });
    }

    if (mode === "analyse") {
      if (!image) return res.status(400).json({ error: "Image required" });
      const raw = await callModel({
        system: ANALYSE_SYSTEM,
        messages: [{ role: "user", content: "Analyse this chart." }],
        image,
        json: true,
      });
      const clean = raw.replace(/```json|```/g, "").trim();
      return res.json({ analysis: JSON.parse(clean) });
    }

    if (!messages.length) return res.status(400).json({ error: "No message" });
    const context = typeof body.context === "string" ? body.context.slice(0, 3000) : "";
    const base = mode === "transaction" ? TRANSACTION_SYSTEM : CHAT_SYSTEM;
    const system = context ? `${base}\n\nContext from the user's latest chart analysis:\n${context}` : base;
    const reply = await callModel({ system, messages, image });
    res.json({ reply });
  } catch (e) {
    console.error("ai:", e);
    res.status(500).json({ error: "The AI is unavailable right now. Please try again." });
  }
});

app.listen(8787, () => console.log("API running on http://localhost:8787"));