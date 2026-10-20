import { callGemini } from "./gemini.server";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ImageInput = { mediaType: string; data: string }; // base64, no prefix

type Args = { system: string; messages: ChatMsg[]; image?: ImageInput; json?: boolean };

export async function callModel({ system, messages, image, json }: Args): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? "openai";
  if (provider === "anthropic") return callAnthropic({ system, messages, image });
  if (provider === "gemini") return callGemini({ system, messages, image, json });
  return callOpenAI({ system, messages, image, json });
}

async function callOpenAI({ system, messages, image, json }: Args) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const msgs: any[] = [{ role: "system", content: system }];
  messages.forEach((m, i) => {
    const isLast = i === messages.length - 1;
    if (isLast && image && m.role === "user") {
      msgs.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } },
        ],
      });
    } else msgs.push(m);
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: msgs,
      temperature: 0.4,
      max_tokens: 1200,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ system, messages, image }: Args) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const msgs = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    if (isLast && image && m.role === "user") {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: m.content },
        ],
      };
    }
    return m;
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      system,
      messages: msgs,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}