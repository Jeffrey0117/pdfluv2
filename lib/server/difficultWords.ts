import fs from "fs";
import path from "path";

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
