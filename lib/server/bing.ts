import type { TargetLang } from "@/lib/types";

const AUTH_ENDPOINT = "https://edge.microsoft.com/translate/auth";
const TRANSLATE_ENDPOINT = "https://api-edge.cognitive.microsofttranslator.com/translate";
const TOKEN_TTL_MS = 8 * 60 * 1000;

const LANG_MAP: Record<TargetLang, string> = {
  "zh-TW": "zh-Hant",
  "zh-CN": "zh-Hans",
};

interface BingResponseItem {
  translations?: Array<{ text?: string }>;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  const res = await fetch(AUTH_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Bing 翻譯取得憑證失敗（${res.status}）`);
  }
  const value = await res.text();
  cachedToken = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
  return value;
}

async function requestTranslation(text: string, targetLang: TargetLang, token: string) {
  return fetch(`${TRANSLATE_ENDPOINT}?api-version=3.0&to=${LANG_MAP[targetLang]}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify([{ Text: text }]),
  });
}

export async function translateWithBing(text: string, targetLang: TargetLang): Promise<string> {
  let res = await requestTranslation(text, targetLang, await getToken());

  if (res.status === 401) {
    res = await requestTranslation(text, targetLang, await getToken(true));
  }

  if (!res.ok) {
    throw new Error(`Bing 翻譯服務回應 ${res.status}，請稍後再試`);
  }

  const data = (await res.json()) as BingResponseItem[];
  const translated = data[0]?.translations?.[0]?.text;
  if (typeof translated !== "string" || translated.length === 0) {
    throw new Error("Bing 翻譯回傳格式異常");
  }
  return translated;
}
