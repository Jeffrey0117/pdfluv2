import * as OpenCC from "opencc-js";
import type { TargetLang } from "@/lib/types";

// Google 免費端點的 zh-TW 輸出偶爾夾簡體字與中國用語,伺服器端統一轉繁保底;
// 已是繁體的字句不受影響(歧義字靠 OpenCC 詞庫斷詞,裡/公里/乾/幹實測不誤轉)
const toTaiwan = OpenCC.Converter({ from: "cn", to: "twp" });

export function ensureTargetScript(text: string, targetLang: TargetLang): string {
  return targetLang === "zh-TW" ? toTaiwan(text) : text;
}
