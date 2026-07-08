import { NextRequest, NextResponse } from "next/server";
import { translateFree } from "@/lib/server/freeTranslate";
import { translateWithOpenAi } from "@/lib/server/openai";
import { checkRateLimit } from "@/lib/server/rateLimit";
import type { TranslateRequestBody, TranslateResponseBody } from "@/lib/types";

const MAX_TEXT_LENGTH = 8000;
const TARGET_LANGS = new Set(["zh-TW", "zh-CN"]);

function validate(body: unknown): { ok: true; data: TranslateRequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "請求格式錯誤" };
  }
  const b = body as Record<string, unknown>;

  if (b.provider !== "google" && b.provider !== "openai") {
    return { ok: false, error: "provider 必須是 google 或 openai" };
  }
  if (typeof b.text !== "string" || b.text.trim().length === 0) {
    return { ok: false, error: "text 不可為空" };
  }
  if (b.text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `text 超過 ${MAX_TEXT_LENGTH} 字元上限` };
  }
  if (typeof b.targetLang !== "string" || !TARGET_LANGS.has(b.targetLang)) {
    return { ok: false, error: "targetLang 必須是 zh-TW 或 zh-CN" };
  }
  if (b.provider === "openai") {
    if (typeof b.apiKey !== "string" || b.apiKey.trim().length === 0) {
      return { ok: false, error: "使用 AI 翻譯需要提供 API Key" };
    }
    if (b.baseUrl !== undefined && typeof b.baseUrl === "string" && !/^https?:\/\//.test(b.baseUrl)) {
      return { ok: false, error: "baseUrl 格式錯誤" };
    }
  }

  return { ok: true, data: b as unknown as TranslateRequestBody };
}

export async function POST(req: NextRequest): Promise<NextResponse<TranslateResponseBody>> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: "請求太頻繁，請稍後再試" }, { status: 429 });
  }

  const rawBody = await req.json().catch(() => null);
  const result = validate(rawBody);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const { provider, text, targetLang, apiKey, model, baseUrl } = result.data;

  try {
    const translated =
      provider === "google"
        ? await translateFree(text, targetLang)
        : await translateWithOpenAi(text, targetLang, {
            apiKey: apiKey ?? "",
            model: model?.trim() || "gpt-4o-mini",
            baseUrl: baseUrl?.trim() || "https://api.openai.com/v1",
          });

    return NextResponse.json({ success: true, data: { translated } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻譯失敗，請稍後再試";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
