import { splitTextIntoChunks } from "@/lib/chunk";
import type { TranslateResponseBody, TranslateSettings } from "@/lib/types";

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestTranslate(
  chunk: string,
  settings: TranslateSettings
): Promise<{ status: number; data: TranslateResponseBody | null }> {
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
  return { status: res.status, data };
}

async function translateChunk(chunk: string, settings: TranslateSettings): Promise<string> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(1500 * 2 ** (attempt - 2));

    const { status, data } = await requestTranslate(chunk, settings);
    if (data?.success && data.data) return data.data.translated;

    lastError = data?.error ?? `翻譯請求失敗（HTTP ${status}）`;
    // 參數錯誤重試也沒用;429/5xx 是暫時性的,退避後再試
    if (status === 400) break;
  }
  throw new Error(lastError);
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
