import { createFileRoute } from "@tanstack/react-router";
import { callModel, type ChatMsg } from "@/lib/ai.server";
import { ANALYSE_SYSTEM, CHAT_SYSTEM, OFF_TOPIC_REPLY, PROOF_SYSTEM, TRANSACTION_SYSTEM } from "@/lib/ai-prompts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const mode = body.mode as "chat" | "analyse" | "transaction" | "proof";
          const messages: ChatMsg[] = (Array.isArray(body.messages) ? body.messages : [])
            .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
            .slice(-20)
            .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

          const image = body.image as { mediaType: string; data: string } | undefined;
          if (image) {
            if (!/^image\/(png|jpeg|webp)$/.test(image.mediaType)) return json({ error: "Unsupported image type" }, 400);
            if (image.data.length > 7_000_000) return json({ error: "Image is too large" }, 413);
          }

          if (mode === "analyse") {
            if (!image) return json({ error: "Image required" }, 400);
            const raw = await callModel({
              system: ANALYSE_SYSTEM,
              messages: [{ role: "user", content: "Analyse this chart." }],
              image,
              json: true,
            });
            const start = raw.indexOf("{");
            const end = raw.lastIndexOf("}");
            if (start === -1 || end <= start) throw new Error("AI returned an unreadable answer");
            return json({ analysis: JSON.parse(raw.slice(start, end + 1)) });
          }

          if (mode === "proof") {
            if (!image) return json({ error: "Image required" }, 400);
            const raw = await callModel({
              system: PROOF_SYSTEM,
              messages: [{ role: "user", content: "Read this payment confirmation." }],
              image,
              json: true,
            });
            const start = raw.indexOf("{");
            const end = raw.lastIndexOf("}");
            if (start === -1 || end <= start) throw new Error("AI returned an unreadable answer");
            return json({ proof: JSON.parse(raw.slice(start, end + 1)) });
          }

          if (!messages.length) return json({ error: "No message" }, 400);
          const context = typeof body.context === "string" ? body.context.slice(0, 3000) : "";
          const base = mode === "transaction" ? TRANSACTION_SYSTEM : CHAT_SYSTEM;
          const system = context
            ? `${base}\n\n${mode === "transaction" ? "Current chat state" : "Context from the user's latest chart analysis"}:\n${context}`
            : base;

          if (mode === "transaction") {
            const raw = await callModel({ system, messages, json: true });
            let parsed: { onTopic?: boolean; reply?: string } | null = null;
            try {
              parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
            } catch {
              parsed = null;
            }
            if (!parsed) {
              return json({ reply: "Sorry, I didn't catch that. Could you rephrase your question about deposits or withdrawals?" });
            }
            // The server decides: anything not clearly on topic gets the fixed reply, whatever the model wrote.
            if (parsed.onTopic !== true || !parsed.reply) return json({ reply: OFF_TOPIC_REPLY });
            return json({ reply: String(parsed.reply).slice(0, 1200) });
          }

          return json({ reply: await callModel({ system, messages, image }) });
        } catch (e) {
          console.error("ai:", e);
          const busy = e instanceof Error && /(Gemini|OpenAI|Anthropic) error (429|500|502|503|504|529)/.test(e.message);
          return json(
            {
              error: busy
                ? "The AI is busy right now. Please try again in a moment."
                : "The AI is unavailable right now. Please try again.",
            },
            busy ? 503 : 500,
          );
        }
      },
    },
  },
});