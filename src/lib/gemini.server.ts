type GeminiArgs = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  image?: { mediaType: string; data: string };
  json?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini({ system, messages, image, json }: GeminiArgs): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const models = [process.env.GEMINI_MODEL ?? "gemini-2.5-flash"];
  if (process.env.GEMINI_FALLBACK_MODEL) models.push(process.env.GEMINI_FALLBACK_MODEL);

  const contents = messages.map((m, i) => {
    const parts: any[] = [{ text: m.content }];
    if (i === messages.length - 1 && image && m.role === "user") {
      parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
    }
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });

  let lastStatus = 0;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        return (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      }
      console.error(`gemini ${model} attempt ${attempt + 1}: ${res.status}`);

      if (res.status === 503 || res.status === 500) {
        lastStatus = res.status;
        if (attempt === 0) {
          await sleep(1500);
          continue; // one retry when Google is busy
        }
        break; // still busy, move on to the next model
      }
      if (res.status === 429) {
        lastStatus = 429;
        break; // rate limit: retrying only makes it worse
      }
      if (res.status === 404) {
        if (!lastStatus) lastStatus = 404;
        break; // model name not available for this key
      }
      throw new Error(`Gemini error ${res.status}`); // bad key or bad request
    }
  }
  throw new Error(`Gemini error ${lastStatus}`);
}