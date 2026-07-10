import type { PageTranslation, PdfFontStyle, TargetLang, WordBankSettings } from "@/lib/types";

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string): void {
  downloadBlob(filename, new Blob([content], { type: "text/plain;charset=utf-8" }));
}

export type PdfMode = "translated" | "bilingual";

export async function fetchPdfBlob(
  baseName: string,
  pages: PageTranslation[],
  mode: PdfMode,
  targetLang: TargetLang,
  coverImage?: string | null,
  wordBank?: WordBankSettings,
  fontStyle?: PdfFontStyle
): Promise<Blob> {
  const wordBankEnabled = wordBank?.enabled === true;
  const res = await fetch("/api/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: baseName,
      mode,
      targetLang,
      ...(fontStyle ? { fontStyle } : {}),
      ...(coverImage ? { coverImage } : {}),
      ...(wordBankEnabled ? { wordBank } : {}),
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        // word bank 要掃英文原文,純翻譯模式也得帶上
        original: mode === "bilingual" || wordBankEnabled ? p.original : "",
        translated: p.translated,
      })),
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `PDF 產生失敗（HTTP ${res.status}）`);
  }

  return res.blob();
}

export function savePdfBlob(baseName: string, mode: PdfMode, blob: Blob): void {
  const suffix = mode === "bilingual" ? "學習版" : "閱讀版";
  downloadBlob(`${baseName}-${suffix}.pdf`, blob);
}

export async function downloadPdf(
  baseName: string,
  pages: PageTranslation[],
  mode: PdfMode,
  targetLang: TargetLang
): Promise<void> {
  savePdfBlob(baseName, mode, await fetchPdfBlob(baseName, pages, mode, targetLang));
}

export function downloadTranslation(baseName: string, pages: PageTranslation[]): void {
  const content = pages
    .map((p) => `── 第 ${p.pageNumber} 頁 ──\n\n${p.translated}`)
    .join("\n\n");
  downloadText(`${baseName}-中文翻譯.txt`, content);
}

export function downloadBilingual(baseName: string, pages: PageTranslation[]): void {
  const content = pages
    .map(
      (p) =>
        `── 第 ${p.pageNumber} 頁 ──\n\n【原文】\n${p.original}\n\n【翻譯】\n${p.translated}`
    )
    .join("\n\n");
  downloadText(`${baseName}-中英對照.txt`, content);
}
