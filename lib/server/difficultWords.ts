import fs from "fs";
import path from "path";
import { translateFree } from "@/lib/server/freeTranslate";
import type { TargetLang } from "@/lib/types";

export interface WordBankOptions {
  /** 勾選的考試標籤(cet4/cet6/toefl/ielts/gre) */
  tags: string[];
  /** 詞頻門檻:排名在此之外(更冷門)才算難字,0 = 不用詞頻只靠標籤 */
  minFreqRank: number;
}

export interface HighlightSegment {
  text: string;
  hl: boolean;
}

export interface BankEntry {
  word: string;
  phonetic: string;
  def: string;
  tags: string[];
  example: HighlightSegment[];
  /** 例句的中文翻譯(免費引擎批次翻譯,失敗時缺省) */
  exampleZh?: string;
}

export interface WordBankPageData {
  /** 與 toParagraphs(original) 一一對應的分段標註 */
  paragraphs: HighlightSegment[][];
  /** 本頁首次出現的難字 */
  bank: BankEntry[];
}

interface DictEntry {
  p: string;
  t: string;
  s: string;
  g: string[];
  f: number;
}

interface Dict {
  words: Record<string, DictEntry>;
  forms: Record<string, string>;
}

let dictCache: Dict | null = null;

function loadDict(): Dict {
  if (!dictCache) {
    const file = path.join(process.cwd(), "lib", "server", "data", "wordbank.json");
    dictCache = JSON.parse(fs.readFileSync(file, "utf8")) as Dict;
  }
  return dictCache;
}

export function toParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const TOKEN_PATTERN = /[A-Za-z][A-Za-z'’-]*/g;
const SENTENCE_END_CHARS = ".!?…";
const MAX_EXAMPLE_CHARS = 220;

function isSentenceStart(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (/\s/.test(ch) || '"“”\'’()'.includes(ch)) continue;
    return SENTENCE_END_CHARS.includes(ch);
  }
  return true;
}

/** 大寫開頭且不在句首視為專有名詞;含多個大寫(縮寫)一律跳過 */
function looksLikeProperNoun(token: string, text: string, index: number): boolean {
  if (!/^[A-Z]/.test(token)) return false;
  if (/[A-Z]/.test(token.slice(1))) return true;
  return !isSentenceStart(text, index);
}

function findBase(token: string, dict: Dict): string | null {
  const lower = token.toLowerCase().replace(/’/g, "'").replace(/'s?$/, "");
  if (lower.length < 3) return null;
  return dict.forms[lower] ?? (dict.words[lower] ? lower : null);
}

/** 沒排名的字視為極冷門 */
const UNRANKED = 0;
/** 排名在此之外的字,即使沒有考試標籤也視為難字(如 beeswax) */
const RARE_RANK = 15000;
/** 使用者沒設詞頻門檻時的底線,擋掉考試字表裡的基礎字(make、order…) */
const DEFAULT_FLOOR = 3000;

function isDifficult(entry: DictEntry, opts: WordBankOptions): boolean {
  const floor = opts.minFreqRank > 0 ? opts.minFreqRank : DEFAULT_FLOOR;
  const rareEnough = entry.f === UNRANKED || entry.f > floor;
  if (!rareEnough) return false;

  // 純詞頻模式:過了門檻就算難字
  if (opts.tags.length === 0) return opts.minFreqRank > 0;

  // 考試模式:要有勾選的標籤;超冷門字沒標籤也收
  return (
    entry.g.some((tag) => opts.tags.includes(tag)) ||
    entry.f === UNRANKED ||
    entry.f > RARE_RANK
  );
}

function sentenceBounds(text: string, index: number, endIndex: number): [number, number] {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (SENTENCE_END_CHARS.includes(text[i])) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = endIndex; i < text.length; i++) {
    if (SENTENCE_END_CHARS.includes(text[i])) {
      end = i + 1;
      break;
    }
  }
  return [start, end];
}

function buildExample(paragraph: string, index: number, token: string): HighlightSegment[] {
  const [rawStart, rawEnd] = sentenceBounds(paragraph, index, index + token.length);
  const start = rawEnd - rawStart > MAX_EXAMPLE_CHARS ? Math.max(rawStart, index - 100) : rawStart;
  const end =
    rawEnd - rawStart > MAX_EXAMPLE_CHARS
      ? Math.min(rawEnd, index + token.length + 100)
      : rawEnd;

  const before = paragraph.slice(start, index).trimStart();
  const after = paragraph.slice(index + token.length, end).trimEnd();
  const prefix = start > rawStart ? "…" : "";
  const suffix = end < rawEnd ? "…" : "";

  return [
    { text: `“${prefix}${before}`, hl: false },
    { text: token, hl: true },
    { text: `${after}${suffix}”`, hl: false },
  ];
}

function analyzeParagraph(
  paragraph: string,
  dict: Dict,
  opts: WordBankOptions,
  seen: Set<string>,
  defKey: "t" | "s"
): { segments: HighlightSegment[]; bank: BankEntry[] } {
  const segments: HighlightSegment[] = [];
  const bank: BankEntry[] = [];
  let cursor = 0;

  for (const match of paragraph.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (looksLikeProperNoun(token, paragraph, index)) continue;

    const base = findBase(token, dict);
    if (!base) continue;
    const entry = dict.words[base];
    if (!isDifficult(entry, opts)) continue;

    if (index > cursor) segments.push({ text: paragraph.slice(cursor, index), hl: false });
    segments.push({ text: token, hl: true });
    cursor = index + token.length;

    if (!seen.has(base)) {
      seen.add(base);
      bank.push({
        word: base,
        phonetic: entry.p,
        def: entry[defKey],
        tags: entry.g,
        example: buildExample(paragraph, index, token),
      });
    }
  }

  if (cursor < paragraph.length) {
    segments.push({ text: paragraph.slice(cursor), hl: false });
  }
  return { segments, bank };
}

/** 例句去掉引號/省略號後的純文字,給翻譯引擎用 */
function examplePlainText(example: HighlightSegment[]): string {
  return example
    .map((seg) => seg.text)
    .join("")
    .replace(/[“”…]/g, "")
    .trim();
}

const TRANSLATE_BATCH_CHARS = 2800;

/**
 * 批次翻譯所有 word bank 例句(多句以換行打包成一次呼叫)。
 * 任一批行數對不上或引擎失敗,該批例句就不附翻譯,不影響匯出。
 */
export async function translateBankExamples(
  wordBank: Record<number, WordBankPageData>,
  targetLang: TargetLang
): Promise<Record<number, WordBankPageData>> {
  const allEntries = Object.values(wordBank).flatMap((page) => page.bank);
  if (allEntries.length === 0) return wordBank;

  const sentences = allEntries.map((entry) => examplePlainText(entry.example));

  // 貪婪打包成 ≤ TRANSLATE_BATCH_CHARS 的批次
  const batches: { start: number; lines: string[] }[] = [];
  let current: string[] = [];
  let currentChars = 0;
  let start = 0;
  sentences.forEach((sentence, i) => {
    if (current.length > 0 && currentChars + sentence.length > TRANSLATE_BATCH_CHARS) {
      batches.push({ start, lines: current });
      current = [];
      currentChars = 0;
      start = i;
    }
    current = [...current, sentence];
    currentChars += sentence.length + 1;
  });
  if (current.length > 0) batches.push({ start, lines: current });

  const translations: (string | undefined)[] = new Array(sentences.length).fill(undefined);
  for (const batch of batches) {
    try {
      const result = await translateFree(batch.lines.join("\n"), targetLang);
      const lines = result.split("\n").map((line) => line.trim());
      if (lines.length === batch.lines.length) {
        lines.forEach((line, i) => {
          if (line.length > 0) translations[batch.start + i] = line;
        });
      }
    } catch (error) {
      console.error(
        "例句翻譯失敗,略過此批:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // 依序把翻譯掛回每頁的 bank(不動原資料)
  let cursor = 0;
  return Object.fromEntries(
    Object.entries(wordBank).map(([pageNumber, page]) => [
      pageNumber,
      {
        ...page,
        bank: page.bank.map((entry) => {
          const exampleZh = translations[cursor];
          cursor++;
          return exampleZh ? { ...entry, exampleZh } : entry;
        }),
      },
    ])
  );
}

/**
 * 掃描所有頁的英文原文,回傳每頁的標註分段與 word bank。
 * 難字每次出現都標註;word bank 只在該字全書第一次出現的頁收錄。
 */
export function buildWordBank(
  pages: { pageNumber: number; original: string }[],
  opts: WordBankOptions,
  targetLang: string
): Record<number, WordBankPageData> {
  const dict = loadDict();
  const defKey = targetLang === "zh-CN" ? "s" : "t";
  const seen = new Set<string>();
  const result: Record<number, WordBankPageData> = {};

  for (const page of pages) {
    const pageParagraphs: HighlightSegment[][] = [];
    const pageBank: BankEntry[] = [];
    for (const paragraph of toParagraphs(page.original)) {
      const { segments, bank } = analyzeParagraph(paragraph, dict, opts, seen, defKey);
      pageParagraphs.push(segments);
      pageBank.push(...bank);
    }
    result[page.pageNumber] = { paragraphs: pageParagraphs, bank: pageBank };
  }
  return result;
}
