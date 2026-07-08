import { splitTextIntoChunks } from "@/lib/chunk";
import type { TranslateResponseBody, TranslateSettings } from "@/lib/types";

async function translateChunk(chunk: string, settings: TranslateSettings): Promise<string> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: settings.provider,
      text: chunk,
      targetLang: settings.targetLang,
      apiKey: settings.provider === "openai" ? settings.apiKey : undefined,
      model: settings.provider === "openai" ? settings.model : undefined,
      baseUrl: settings.provider === "openai" ? settings.baseUrl : undefined,
    }),
  });

  const data = (await res.json().catch(() => null)) as TranslateResponseBody | null;
  if (!data?.success || !data.data) {
    throw new Error(data?.error ?? `翻譯請求失敗（HTTP ${res.status}）`);
  }
  return data.data.translated;
}

export async function translatePageText(
  pageText: string,
  settings: TranslateSettings
): Promise<string> {
  const trimmed = pageText.trim();
  if (trimmed.length === 0) return "";

  const chunks = splitTextIntoChunks(trimmed);
  const results: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    if (index > 0 && settings.provider === "google") {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    results.push(await translateChunk(chunk, settings));
  }
  return results.join("\n\n");
}
