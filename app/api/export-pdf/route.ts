import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { buildWordBank, type WordBankOptions } from "@/lib/server/difficultWords";
import {
  TranslationPdf,
  type ExportMode,
  type ExportPage,
  type TranslationPdfProps,
} from "@/lib/server/pdfDocument";

const MAX_PAGES = 2000;
const MAX_TOTAL_CHARS = 2_000_000;
const COVER_PREFIX = /^data:image\/(jpeg|png);base64,/;
// base64 膨脹約 4/3,對應解碼後約 8MB
const MAX_COVER_CHARS = 11_000_000;
const TARGET_LANGS = new Set(["zh-TW", "zh-CN"]);
const MODES = new Set<ExportMode>(["translated", "bilingual"]);
const WORD_BANK_TAGS = new Set(["cet4", "cet6", "toefl", "ielts", "gre"]);

function parseWordBankOptions(raw: unknown): WordBankOptions | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const w = raw as Record<string, unknown>;
  if (w.enabled !== true) return undefined;

  const tags = Array.isArray(w.tags)
    ? w.tags.filter((t): t is string => typeof t === "string" && WORD_BANK_TAGS.has(t))
    : [];
  const minFreqRank =
    typeof w.minFreqRank === "number" && Number.isFinite(w.minFreqRank)
      ? Math.min(100000, Math.max(0, Math.floor(w.minFreqRank)))
      : 0;

  // 沒選考試也沒設詞頻,等於沒有判定標準
  if (tags.length === 0 && minFreqRank === 0) return undefined;
  return { tags, minFreqRank };
}

function validate(
  body: unknown
):
  | { ok: true; data: TranslationPdfProps; wordBankOpts?: WordBankOptions }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "請求格式錯誤" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.mode !== "string" || !MODES.has(b.mode as ExportMode)) {
    return { ok: false, error: "mode 必須是 translated 或 bilingual" };
  }
  if (typeof b.targetLang !== "string" || !TARGET_LANGS.has(b.targetLang)) {
    return { ok: false, error: "targetLang 必須是 zh-TW 或 zh-CN" };
  }
  if (!Array.isArray(b.pages) || b.pages.length === 0 || b.pages.length > MAX_PAGES) {
    return { ok: false, error: "pages 必須是 1 至 2000 筆的陣列" };
  }

  let totalChars = 0;
  const pages: ExportPage[] = [];
  for (const raw of b.pages) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: "pages 內容格式錯誤" };
    }
    const p = raw as Record<string, unknown>;
    if (typeof p.pageNumber !== "number" || typeof p.translated !== "string") {
      return { ok: false, error: "每一頁需要 pageNumber 與 translated" };
    }
    const original = typeof p.original === "string" ? p.original : "";
    totalChars += p.translated.length + original.length;
    pages.push({ pageNumber: p.pageNumber, original, translated: p.translated });
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return { ok: false, error: "內容過大，無法產生 PDF" };
  }

  const fileName =
    typeof b.fileName === "string" && b.fileName.trim().length > 0
      ? b.fileName.trim().slice(0, 120)
      : "翻譯文件";

  let coverImage: string | undefined;
  if (b.coverImage !== undefined) {
    if (
      typeof b.coverImage !== "string" ||
      !COVER_PREFIX.test(b.coverImage) ||
      b.coverImage.length > MAX_COVER_CHARS
    ) {
      return { ok: false, error: "封面圖片格式錯誤或過大（僅支援 JPG/PNG，8MB 以內）" };
    }
    coverImage = b.coverImage;
  }

  return {
    ok: true,
    data: {
      fileName,
      mode: b.mode as ExportMode,
      targetLang: b.targetLang as TranslationPdfProps["targetLang"],
      pages,
      ...(coverImage ? { coverImage } : {}),
    },
    wordBankOpts: parseWordBankOptions(b.wordBank),
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: "請求太頻繁，請稍後再試" }, { status: 429 });
  }

  const rawBody = await req.json().catch(() => null);
  const result = validate(rawBody);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  try {
    const wordBank = result.wordBankOpts
      ? buildWordBank(result.data.pages, result.wordBankOpts, result.data.targetLang)
      : undefined;
    const element = createElement(TranslationPdf, {
      ...result.data,
      ...(wordBank ? { wordBank } : {}),
    }) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          `${result.data.fileName}.pdf`
        )}`,
      },
    });
  } catch (error) {
    console.error("PDF 產生失敗:", error);
    return NextResponse.json({ success: false, error: "PDF 產生失敗，請稍後再試" }, { status: 500 });
  }
}
