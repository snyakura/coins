import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Info, Lock, MessageSquare, RefreshCw, Send, Sparkles, Upload, ImageIcon } from "lucide-react";
import { CoinspaceShell } from "@/components/CoinspaceShell";
import { Button } from "@/components/ui/button";
import { analyseChart, chatWithAI, prepareImage, type Analysis, type Msg } from "@/lib/ai-client";

export const Route = createFileRoute("/ai-analyser")({
  head: () => ({
    meta: [
      { title: "AI Chart Analyser — Coinspace" },
      { name: "description", content: "Upload a forex chart or chat with Coinspace AI about the markets." },
      { property: "og:title", content: "AI Chart Analyser — Coinspace" },
      { property: "og:description", content: "Key chart levels and forex reasoning, powered by AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiAnalyserPage,
});

type HistoryItem = { pair: string; timeframe: string; bias: string; confidence: number; at: number };
const QUICK_PROMPTS = ["What moves EUR/USD most?", "Explain support and resistance", "How should I size a forex trade?"];
const biasStyle = {
  bullish: { text: "text-positive", ring: "border-positive", soft: "bg-positive-soft" },
  bearish: { text: "text-negative", ring: "border-negative", soft: "bg-muted" },
  neutral: { text: "text-muted-foreground", ring: "border-border", soft: "bg-muted" },
};

function AiAnalyserPage() {
  const [tab, setTab] = useState<"analyse" | "chat">("analyse");

  // analysis
  const [image, setImage] = useState<{ preview: string; mediaType: string; data: string; name: string } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // chat
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi, I'm Coinspace AI. Ask me anything about forex, or upload a chart in the Chart analysis tab." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("coinspace-analyses");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, tab]);

  async function onFile(file?: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setAnalyseError("Please upload a PNG, JPG or WebP image.");
    if (file.size > 10 * 1024 * 1024) return setAnalyseError("Image must be under 10 MB.");
    try {
      const img = await prepareImage(file);
      setImage({ ...img, name: file.name });
      setAnalysis(null);
      setAnalyseError("");
    } catch {
      setAnalyseError("Couldn't read that image. Try another one.");
    }
  }

  async function runAnalysis() {
    if (!image || analysing) return;
    setAnalysing(true);
    setAnalyseError("");
    try {
      const result = await analyseChart({ mediaType: image.mediaType, data: image.data });
      setAnalysis(result);
      if (result.isChart) {
        const next = [{ pair: result.pair, timeframe: result.timeframe, bias: result.bias, confidence: result.confidence, at: Date.now() }, ...history].slice(0, 6);
        setHistory(next);
        try { localStorage.setItem("coinspace-analyses", JSON.stringify(next)); } catch {}
      }
    } catch (e) {
      setAnalyseError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalysing(false);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    setChatError("");
    const context = analysis?.isChart
      ? `${analysis.pair} ${analysis.timeframe}, bias ${analysis.bias} (${analysis.confidence}%). Resistance: ${analysis.resistance.join(", ")}. Support: ${analysis.support.join(", ")}. ${analysis.summary}`
      : undefined;
    try {
      const reply = await chatWithAI(next.slice(1), context); // skip the greeting
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Message failed.");
    } finally {
      setSending(false);
    }
  }

  const style = analysis ? biasStyle[analysis.bias] : biasStyle.neutral;

  return (
    <CoinspaceShell>
      <main className="page-container py-6 sm:py-8">
        <h1 className="text-3xl font-extrabold sm:text-5xl">Analyse any chart with AI</h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Upload a forex chart for key levels and reasoning, or just chat about the markets.
        </p>

        {/* Tabs */}
        <div className="mt-5 inline-flex rounded-full border border-border p-1" role="tablist">
          {([["analyse", "Chart analysis", ImageIcon], ["chat", "Ask AI", MessageSquare]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "analyse" ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_.9fr]">
            {/* Upload / preview */}
            <section className="panel overflow-hidden">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              {!image ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                  className="grid min-h-[320px] w-full place-items-center p-6 text-center hover:bg-muted/40 sm:min-h-[420px]"
                >
                  <div>
                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted"><Upload size={22} /></span>
                    <p className="mt-4 font-bold">Upload a chart screenshot</p>
                    <p className="mt-1 text-sm text-muted-foreground">Drag and drop or tap to choose. PNG, JPG or WebP, up to 10 MB.</p>
                  </div>
                </button>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{image.name}</p>
                      <p className="text-[11px] text-muted-foreground">Image ready</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                        <RefreshCw size={15} /> <span className="hidden sm:inline">Replace image</span>
                      </Button>
                      <Button variant="dark" size="sm" onClick={runAnalysis} disabled={analysing}>
                        <Sparkles size={15} /> {analysing ? "Analysing…" : "Analyse"}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <img src={image.preview} alt="Uploaded chart" className="max-h-[520px] w-full rounded-md object-contain" />
                  </div>
                </>
              )}
              {analyseError && <p className="border-t border-border p-4 text-sm text-negative">{analyseError}</p>}
            </section>

            {/* Result */}
            <aside className="panel p-4">
              <h2 className="text-lg font-bold">AI Analysis Result</h2>

              {analysing && <p className="mt-6 animate-pulse text-sm text-muted-foreground">Reading the chart…</p>}

              {!analysing && !analysis && (
                <p className="mt-6 text-sm text-muted-foreground">Upload a chart and press Analyse. Your result will appear here.</p>
              )}

              {!analysing && analysis && !analysis.isChart && (
                <p className="mt-6 rounded-md bg-muted p-3 text-sm">{analysis.summary}</p>
              )}

              {!analysing && analysis?.isChart && (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">{analysis.pair} · {analysis.timeframe}</p>
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className={`mx-auto grid aspect-square w-full max-w-[170px] place-items-center rounded-full border-[9px] ${style.ring}`}>
                      <div className="text-center">
                        <strong className={`block text-xl capitalize ${style.text}`}>{analysis.bias}</strong>
                        <span className="text-2xl font-extrabold">{Math.round(analysis.confidence)}%</span>
                        <small className="block text-muted-foreground">confidence</small>
                      </div>
                    </div>
                    <p className={`rounded-md p-3 text-xs leading-5 ${style.soft}`}>{analysis.summary}</p>
                  </div>

                  <div className="mt-4 divide-y divide-border border-y border-border">
                    {([["Resistance", analysis.resistance, ArrowUp], ["Support", analysis.support, ArrowDown]] as const).map(([title, levels, Icon]) => (
                      <div key={title} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-4">
                        <span className="grid size-8 place-items-center rounded-full bg-muted"><Icon size={16} /></span>
                        <p className="text-sm font-bold">{title}</p>
                        <strong className="text-right text-base">{levels.length ? levels.join(" · ") : "—"}</strong>
                      </div>
                    ))}
                  </div>

                  {analysis.reasoning.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-bold">Reasoning</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                        {analysis.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.risks.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-bold">Risks to watch</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                        {analysis.risks.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { setTab("chat"); setInput("Explain this analysis in more detail."); }}>
                    <MessageSquare size={15} /> Discuss this with AI
                  </Button>
                </>
              )}

              <div className="mt-4 flex gap-3 rounded-md bg-warning-soft p-3">
                <Info className="shrink-0" size={18} />
                <div>
                  <p className="text-sm font-bold">Not financial advice</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">AI analysis can be wrong. It is for information only and is not financial advice.</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <section className="panel mt-5 flex h-[calc(100dvh-20rem)] min-h-[420px] flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 sm:max-w-[75%] ${m.role === "user" ? "bg-foreground text-background" : "bg-muted"}`}>
                    {m.content}
                  </p>
                </div>
              ))}
              {sending && <p className="animate-pulse text-sm text-muted-foreground">Coinspace AI is typing…</p>}
              {chatError && <p className="text-sm text-negative">{chatError}</p>}
              <div ref={endRef} />
            </div>
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">{q}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-border p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about forex…"
                maxLength={1000}
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" variant="dark" size="sm" disabled={sending || !input.trim()} aria-label="Send">
                <Send size={15} />
              </Button>
            </form>
          </section>
        )}

        {/* Premium (coming soon) */}
        <section className="panel mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"><Lock size={18} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Coinspace Strategy Premium</h2>
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold">Coming soon</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Run your charts through the Coinspace trading strategy for a monthly fee. We'll announce it here when it launches.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>Upcoming feature</Button>
        </section>

        {/* Recent analyses */}
        {history.length > 0 && (
          <>
            <h2 className="mt-7 text-lg font-bold">Recent analyses</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((h) => {
                const s = biasStyle[h.bias as keyof typeof biasStyle] ?? biasStyle.neutral;
                return (
                  <div key={h.at} className="panel p-3">
                    <p className="font-bold">{h.pair} {h.timeframe}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString()}</p>
                    <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs capitalize ${s.soft} ${s.text}`}>{h.bias} {Math.round(h.confidence)}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </CoinspaceShell>
  );
}