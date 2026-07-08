import { translateWithBing } from "@/lib/server/bing";
import { translateWithGoogle } from "@/lib/server/google";
import type { TargetLang } from "@/lib/types";

const GOOGLE_COOLDOWN_MS = 2 * 60 * 1000;

let googleBlockedUntil = 0;

export async function translateFree(text: string, targetLang: TargetLang): Promise<string> {
  if (Date.now() >= googleBlockedUntil) {
    try {
      return await translateWithGoogle(text, targetLang);
    } catch (error) {
      console.error("Google 翻譯失敗，切換 Bing:", error instanceof Error ? error.message : error);
      googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
    }
  }
  return translateWithBing(text, targetLang);
}
