import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface ExtractedPdf {
  pageCount: number;
  pages: string[];
}

interface Line {
  y: number;
  height: number;
  parts: string[];
}

function itemsToLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of items) {
    if (item.str.trim().length === 0) continue;
    const y = item.transform[5];
    const last = lines[lines.length - 1];
    if (last && Math.abs(y - last.y) <= 2) {
      last.parts.push(item.str);
      last.height = Math.max(last.height, item.height || 0);
    } else {
      lines.push({ y, height: item.height || 10, parts: [item.str] });
    }
  }
  return lines;
}

function joinIntoParagraph(current: string, text: string): string {
  if (current.length === 0) return text;
  if (/[A-Za-z]-$/.test(current)) return current.slice(0, -1) + text;
  return `${current} ${text}`;
}

function linesToParagraphs(lines: Line[]): string {
  const paragraphs: string[] = [];
  let current = "";
  let prev: Line | null = null;

  for (const line of lines) {
    const text = line.parts.join(" ").replace(/\s+/g, " ").trim();
    if (text.length === 0) continue;

    const lineSize = Math.max(line.height, prev?.height ?? 0, 8);
    const gap = prev === null ? 0 : Math.abs(prev.y - line.y);
    const isNewParagraph = prev !== null && gap > lineSize * 1.7;

    if (prev !== null && isNewParagraph && current.length > 0) {
      paragraphs.push(current);
      current = text;
    } else {
      current = joinIntoParagraph(current, text);
    }
    prev = line;
  }

  if (current.length > 0) paragraphs.push(current);
  return paragraphs.join("\n\n");
}

export async function extractPdfPages(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter((it): it is TextItem => "str" in it);
    pages.push(linesToParagraphs(itemsToLines(items)));
    onProgress?.(i, doc.numPages);
  }

  await doc.cleanup();
  return { pageCount: pages.length, pages };
}
