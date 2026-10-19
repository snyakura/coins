export type Analysis = {
  isChart: boolean;
  pair: string;
  timeframe: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  resistance: string[];
  support: string[];
  summary: string;
  reasoning: string[];
  risks: string[];
};
export type Msg = { role: "user" | "assistant"; content: string };

async function post(payload: unknown) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export const analyseChart = (image: { mediaType: string; data: string }): Promise<Analysis> =>
  post({ mode: "analyse", image }).then((d) => d.analysis);

export const chatWithAI = (messages: Msg[], context?: string, mode: "chat" | "transaction" = "chat"): Promise<string> =>
  post({ mode, messages, context }).then((d) => d.reply);

// Downscale to keep uploads fast and cheap, returns base64 JPEG
export async function prepareImage(file: File): Promise<{ preview: string; mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { preview, mediaType: "image/jpeg", data: preview.split(",")[1] };
}