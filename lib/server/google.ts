import type { TargetLang } from "@/lib/types";

const GOOGLE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

type GoogleSegment = [string, ...unknown[]];

const MAX_RETRIES = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function translateWithGoogle(text: string, targetLang: TargetLang): Promise<string> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: targetLang,
    dt: "t",
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.floor(1000 * attempt * 0.5));

    const res = await fetch(`${GOOGLE_ENDPOINT}?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ q: text }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = (await res.json()) as [GoogleSegment[] | null, ...unknown[]];
      const segments = data[0];
      if (!Array.isArray(segments)) {
        throw new Error("Google 翻譯回傳格式異常");
      }
      return segments.map((seg) => (typeof seg[0] === "string" ? seg[0] : "")).join("");
    }

    lastStatus = res.status;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) break;
  }

  if (lastStatus === 429) {
    throw new Error("Google 免費翻譯暫時被限流（429），請等幾分鐘再按重試，或改用 AI 翻譯（GPT key）");
  }
  throw new Error(`Google 翻譯服務回應 ${lastStatus}，請稍後再試`);
}
