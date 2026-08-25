import { translateWithGoogle } from "@/lib/server/google";
import { ensureTargetScript } from "@/lib/server/zhConvert";
import type { TargetLang } from "@/lib/types";

// Bing 免費憑證端點已被微軟下架(404),備援移除,只走 Google
const GOOGLE_COOLDOWN_MS = 60 * 1000;

let googleBlockedUntil = 0;

export async function translateFree(text: string, targetLang: TargetLang): Promise<string> {
  if (Date.now() < googleBlockedUntil) {
    throw new Error("Google 免費翻譯暫時被限流（429），請等幾分鐘再按重試，或改用 AI 翻譯（GPT key）");
  }
  try {
    return ensureTargetScript(await translateWithGoogle(text, targetLang), targetLang);
  } catch (error) {
    if (error instanceof Error && error.message.includes("429")) {
      googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
    }
    throw error;
  }
}
