import type { PageTranslation, TargetLang } from "@/lib/types";

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
  targetLang: TargetLang
): Promise<Blob> {
  const res = await fetch("/api/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: baseName,
      mode,
      targetLang,
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        original: mode === "bilingual" ? p.original : "",
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
  const suffix = mode === "bilingual" ? "中英對照" : "中文翻譯";
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
