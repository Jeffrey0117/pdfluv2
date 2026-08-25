import type { TargetLang } from "@/lib/types";

// translate.googleapis.com 的 gtx 端點會擋 Node 連線指紋(curl 能過、undici 一律 429),
// 改用 clients5 的 dict-chrome-ex 端點:支援 POST 長文、保留換行、zh-TW 直出繁體
const GOOGLE_ENDPOINT = "https://clients5.google.com/translate_a/t";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MAX_RETRIES = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 回傳每筆是 [譯文, 偵測語言] 或直接是譯文字串
function parseTranslated(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  const first: unknown = data[0];
  if (typeof first === "string") return first;
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return null;
}

export async function translateWithGoogle(text: string, targetLang: TargetLang): Promise<string> {
  const params = new URLSearchParams({
    client: "dict-chrome-ex",
    sl: "auto",
    tl: targetLang,
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.floor(1000 * attempt * 0.5));

    const res = await fetch(`${GOOGLE_ENDPOINT}?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_UA,
      },
      body: new URLSearchParams({ q: text }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const translated = parseTranslated(await res.json());
      if (translated === null) {
        throw new Error("Google 翻譯回傳格式異常");
      }
      return translated;
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
