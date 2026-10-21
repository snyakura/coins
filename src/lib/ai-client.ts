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

export type ProofRead = {
  isReceipt: boolean;
  amount: number | null;
  currency: string;
  reference: string;
  sender: string;
  status: "success" | "failed" | "pending" | "unknown";
  confidence: number;
};

export const readProof = async (image: { mediaType: string; data: string }): Promise<ProofRead> => {
  const p = (await post({ mode: "proof", image })).proof ?? {};
  const amount = typeof p.amount === "number" ? p.amount : parseFloat(String(p.amount ?? "").replace(/[^0-9.]/g, ""));
  return {
    isReceipt: p.isReceipt === true,
    amount: Number.isFinite(amount) ? amount : null,
    currency: String(p.currency ?? ""),
    reference: String(p.reference ?? ""),
    sender: String(p.sender ?? ""),
    status: ["success", "failed", "pending"].includes(p.status) ? p.status : "unknown",
    confidence: Number(p.confidence) || 0,
  };
};