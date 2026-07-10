/**
 * 從 ECDICT(https://github.com/skywind3000/ECDICT,MIT)抽出難字字表。
 *
 * 用法:node scripts/build-wordbank.mjs <ecdict.csv 路徑>
 * 產出:lib/server/data/wordbank.json
 *
 * 收錄條件:有考試標籤(cet4/cet6/toefl/ielts/gre)或 COCA 詞頻排名 ≤ 30000。
 * 每字含:音標、繁/簡釋義、考試標籤、詞頻、變化形(供 lied→lie 還原查表)。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as OpenCC from "opencc-js";

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("用法:node scripts/build-wordbank.mjs <ecdict.csv 路徑>");
  process.exit(1);
}

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(projectRoot, "lib", "server", "data", "wordbank.json");

const EXAM_TAGS = new Set(["cet4", "cet6", "toefl", "ielts", "gre"]);
const MAX_FREQ_RANK = 30000;
const MAX_DEF_CHARS = 110;
const WORD_SHAPE = /^[a-z][a-z'-]{1,28}[a-z]$/;

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cleanDefinition(raw) {
  const oneLine = raw.replaceAll("\\n", ";").replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_DEF_CHARS ? `${oneLine.slice(0, MAX_DEF_CHARS)}…` : oneLine;
}

function parseExchange(raw, word) {
  if (!raw) return [];
  return raw
    .split("/")
    .map((pair) => pair.split(":"))
    .filter(([type, form]) => type && form && !["0", "1"].includes(type))
    .map(([, form]) => form.toLowerCase())
    .filter((form) => form !== word && WORD_SHAPE.test(form));
}

// exchange 的 0: 是反向指標:「這個字的原形是誰」(如 lied 行記 0:lie)
function parseLemmaPointer(raw) {
  if (!raw || !raw.includes("0:")) return null;
  const pair = raw.split("/").find((p) => p.startsWith("0:"));
  const base = pair?.slice(2).toLowerCase().trim();
  return base && WORD_SHAPE.test(base) ? base : null;
}

console.log("讀取 CSV…");
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const header = rows[0];
const col = Object.fromEntries(header.map((name, i) => [name, i]));
console.log(`共 ${rows.length - 1} 筆,開始篩選…`);

const toTraditional = OpenCC.Converter({ from: "cn", to: "twp" });

const words = {};
const forms = {};
const lemmaOf = {};
let kept = 0;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const word = (row[col.word] ?? "").toLowerCase().trim();
  if (!WORD_SHAPE.test(word)) continue;

  // 反向指標要掃全部行:lied 本身不會被收錄,但它知道自己的原形是 lie
  const lemma = parseLemmaPointer(row[col.exchange]);
  if (lemma && lemma !== word) lemmaOf[word] = lemma;

  const tags = (row[col.tag] ?? "")
    .split(/\s+/)
    .filter((t) => EXAM_TAGS.has(t));
  const frq = Number(row[col.frq]) || 0;
  const hasExamTag = tags.length > 0;
  const isCommonRanked = frq > 0 && frq <= MAX_FREQ_RANK;
  if (!hasExamTag && !isCommonRanked) continue;

  const defSc = cleanDefinition(row[col.translation] ?? "");
  if (!defSc) continue;

  words[word] = {
    p: (row[col.phonetic] ?? "").trim(),
    t: toTraditional(defSc),
    s: defSc,
    g: tags,
    f: frq,
  };
  for (const form of parseExchange(row[col.exchange], word)) {
    forms[form] = word;
  }
  kept++;
  if (kept % 5000 === 0) console.log(`  已收 ${kept} 字…`);
}

// 反向指標補進 forms(正向 exchange 沒列到的變化形,如 lie 只列 p:lay 漏了 lied)
for (const [form, base] of Object.entries(lemmaOf)) {
  if (words[base] && !forms[form]) forms[form] = base;
}

// 變化形撞到收錄的單字時(如 lied 既是 lie 的過去式、也是罕用字「藝術歌曲」),
// 比較詞頻:單字本身較常用才保留單字,否則還原到較常用的原形
for (const [form, base] of Object.entries(forms)) {
  const standalone = words[form];
  if (!standalone) continue;
  const standaloneFrq = standalone.f > 0 ? standalone.f : Infinity;
  const baseFrq = words[base].f > 0 ? words[base].f : Infinity;
  if (standaloneFrq <= baseFrq) delete forms[form];
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ words, forms }));

const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`完成:${kept} 字、${Object.keys(forms).length} 個變化形 → ${outPath}(${sizeMb} MB)`);
