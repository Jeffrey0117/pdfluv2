// ECDICT 精簡詞典：assets/dict.json 載入記憶體，查詢含詞形還原
import { promises as fs } from "node:fs";
import path from "node:path";

interface DictData {
  words: Record<string, [string, string]>; // word → [phonetic, translation]
  lemma: Record<string, string>; // 變形 → 原形
}

export interface DictEntry {
  word: string;
  phonetic: string;
  translation: string;
  base?: string; // 查到的是原形時，回報原形
}

const globalAny = globalThis as { __dictData?: Promise<DictData> };

function loadDict(): Promise<DictData> {
  if (!globalAny.__dictData) {
    globalAny.__dictData = fs
      .readFile(path.join(process.cwd(), "assets", "dict.json"), "utf8")
      .then((raw) => JSON.parse(raw) as DictData);
  }
  return globalAny.__dictData;
}

// 常見字尾規則（lemma 表沒涵蓋時的保險）
function* candidates(w: string): Generator<string> {
  yield w;
  if (w.endsWith("'s")) yield w.slice(0, -2);
  if (w.endsWith("ies") && w.length > 4) yield w.slice(0, -3) + "y";
  if (w.endsWith("es") && w.length > 3) yield w.slice(0, -2);
  if (w.endsWith("s") && w.length > 2) yield w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) {
    yield w.slice(0, -3);
    yield w.slice(0, -3) + "e";
  }
  if (w.endsWith("ed") && w.length > 4) {
    yield w.slice(0, -2);
    yield w.slice(0, -1);
  }
  if (w.endsWith("ly") && w.length > 4) yield w.slice(0, -2);
  if (w.endsWith("er") && w.length > 4) yield w.slice(0, -2);
  if (w.endsWith("est") && w.length > 5) yield w.slice(0, -3);
}

export async function lookup(raw: string): Promise<DictEntry | null> {
  const data = await loadDict();
  const w = raw.toLowerCase().trim();
  if (!w || !/^[a-z][a-z'-]*$/.test(w)) return null;

  const tryWord = (key: string, base?: string): DictEntry | null => {
    const hit = data.words[key];
    return hit ? { word: key, phonetic: hit[0], translation: hit[1], base } : null;
  };

  const direct = tryWord(w);
  if (direct) return direct;

  const viaLemma = data.lemma[w];
  if (viaLemma) {
    const hit = tryWord(viaLemma, viaLemma);
    if (hit) return { ...hit, word: w };
  }

  for (const cand of candidates(w)) {
    if (cand === w) continue;
    const hit = tryWord(cand, cand);
    if (hit) return { ...hit, word: w };
    const lem = data.lemma[cand];
    if (lem) {
      const h2 = tryWord(lem, lem);
      if (h2) return { ...h2, word: w };
    }
  }
  return null;
}
