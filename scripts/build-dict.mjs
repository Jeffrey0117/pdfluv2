// 一次性建置：ECDICT csv → assets/dict.json（常用詞精簡版，釋義轉繁體）
// 用法：node scripts/build-dict.mjs <path-to-ecdict.csv>
// 產物進 repo；csv 本身不進（66MB）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as OpenCC from "opencc-js";

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("usage: node scripts/build-dict.mjs <ecdict.csv>");
  process.exit(1);
}

const toTW = OpenCC.Converter({ from: "cn", to: "tw" });

// 簡易 CSV 解析（處理引號內逗號/換行/雙引號跳脫）
function* parseCsv(text) {
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      yield row;
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

// 釋義精簡：去掉 [网络] 行、最多三行、整段上限 150 字
function trimTranslation(raw) {
  const lines = String(raw)
    .split("\\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("[网络]") && !l.startsWith("[網絡]"));
  return toTW(lines.slice(0, 3).join("；")).slice(0, 150);
}

const text = fs.readFileSync(csvPath, "utf8");
const words = {};
const lemma = {};
let total = 0;
let kept = 0;
let header = null;

for (const row of parseCsv(text)) {
  if (!header) {
    header = row;
    continue;
  }
  total++;
  const [word, phonetic, , translation, , collins, oxford, tag, bnc, frq, exchange] = row;
  if (!word || !translation) continue;
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(word)) continue; // 只收單一單字
  const col = Number(collins) || 0;
  const oxf = Number(oxford) || 0;
  const fb = Number(bnc) || 0;
  const ff = Number(frq) || 0;
  const tagged = (tag || "").trim().length > 0;
  const common = col > 0 || oxf > 0 || tagged || (ff > 0 && ff <= 60000) || (fb > 0 && fb <= 60000);
  if (!common) continue;
  const key = word.toLowerCase();
  if (!words[key]) {
    words[key] = [phonetic || "", trimTranslation(translation)];
    kept++;
  }
  // exchange: "p:took/d:taken/3:takes/..." → 各變形指回原形
  if (exchange) {
    for (const part of exchange.split("/")) {
      const idx = part.indexOf(":");
      if (idx < 1) continue;
      const kind = part.slice(0, idx);
      const form = part.slice(idx + 1).toLowerCase();
      if (kind === "0" || kind === "1") continue; // 0/1 是反向指標，不建
      if (/^[a-z][a-z'-]*$/.test(form) && form !== key && !lemma[form]) lemma[form] = key;
    }
  }
}

// 變形若已有自己的詞條就不需要 lemma 轉向
for (const form of Object.keys(lemma)) {
  if (words[form]) delete lemma[form];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "assets", "dict.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ words, lemma }));
const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`total ${total} rows → kept ${kept} words, ${Object.keys(lemma).length} lemma links, ${mb}MB → ${outPath}`);
