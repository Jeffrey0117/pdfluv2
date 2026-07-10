export type Provider = "google" | "openai";

export type TargetLang = "zh-TW" | "zh-CN";

export interface WordBankSettings {
  enabled: boolean;
  /** 勾選的考試字表(cet4/cet6/toefl/ielts/gre) */
  tags: string[];
  /** 詞頻門檻:排名在此之內的常用字不標 */
  minFreqRank: number;
}

export interface TranslateSettings {
  provider: Provider;
  targetLang: TargetLang;
  apiKey: string;
  model: string;
  baseUrl: string;
  wordBank: WordBankSettings;
}

export interface TranslateRequestBody {
  provider: Provider;
  text: string;
  targetLang: TargetLang;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface TranslateResponseBody {
  success: boolean;
  data?: { translated: string };
  error?: string;
}

export interface PageTranslation {
  pageNumber: number;
  original: string;
  translated: string;
  status: "pending" | "translating" | "done" | "error";
  error?: string;
}

export const DEFAULT_SETTINGS: TranslateSettings = {
  provider: "google",
  targetLang: "zh-TW",
  apiKey: "",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  wordBank: {
    enabled: false,
    tags: ["toefl", "ielts"],
    minFreqRank: 3000,
  },
};
