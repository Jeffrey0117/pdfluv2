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

/**
 * 過濾旁註與註腳標記:
 * - 以長文字塊(≥20 字)推出本文欄的 x 範圍與正文字高
 * - 完全落在本文欄外的文字塊是旁註/側欄標語,丟棄
 * - 字高明顯縮小的純數字小塊是上標註腳編號(如 "20%¹⁰" 的 10),丟棄
 */
function filterMarginalia(items: TextItem[]): TextItem[] {
  const bodyItems = items.filter((it) => it.str.trim().length >= 20);
  if (bodyItems.length < 3) return items;

  const left = Math.min(...bodyItems.map((it) => it.transform[4]));
  const right = Math.max(...bodyItems.map((it) => it.transform[4] + (it.width || 0)));
  const heights = bodyItems.map((it) => it.height || 10).sort((a, b) => a - b);
  const bodyHeight = heights[Math.floor(heights.length / 2)];

  return items.filter((it) => {
    const x0 = it.transform[4];
    const x1 = x0 + (it.width || 0);
    const overlapsColumn = x1 > left - 2 && x0 < right + 2;
    if (!overlapsColumn) return false;

    const isFootnoteMark =
      /^\d{1,3}$/.test(it.str.trim()) && (it.height || bodyHeight) < bodyHeight * 0.75;
    return !isFootnoteMark;
  });
}

function itemsToLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of filterMarginalia(items)) {
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

// 整段只有數字/百分比/破折號之類的,是圖表殘渣不是內文
const JUNK_PARAGRAPH = /^[\d\s%$\-–—.,:;()"'“”×xX]+$/;

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
  return paragraphs.filter((p) => !JUNK_PARAGRAPH.test(p)).join("\n\n");
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
