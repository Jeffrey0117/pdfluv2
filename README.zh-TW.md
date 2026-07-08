<p align="center">
  <img src="app/icon.svg" alt="PDFluv2" width="96" />
</p>
<h1 align="center">PDFluv2</h1>
<p align="center">
  <strong>丟進一份英文 PDF，拿回一本中文書。</strong>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>
<p align="center">
  <a href="README.md">English</a> | 繁體中文
</p>

---

## 想像一下

你手上有一本 205 頁的英文商業書 PDF。把它拖進 PDFluv2，看著頁面一頁一頁變綠。幾分鐘後按一顆按鈕——下載一份排版好的中文 PDF：有頁碼、內嵌字型、每一段都讀得順。想要對照版也有：每段英文原文下面緊跟中文翻譯，像一本真正的雙語對照書。

不用註冊、檔案不上傳到任何伺服器、不需要 API key。

---

## 為什麼不直接用⋯？

|  | Google 翻譯（文件） | 貼給 ChatGPT | **PDFluv2** |
|---|---|---|---|
| 整本書的 PDF | 10 MB 上限、格式跑掉 | 有貼上長度限制，要一頁頁餵 | **不限大小，自動逐頁跑** |
| 產出 | 亂掉的網頁 | 聊天泡泡 | **排版好的 PDF（純翻譯／中英對照）** |
| 費用 | 免費 | 量大要訂閱 | **免費（Google/Bing）或自帶 GPT key** |
| 被限流怎麼辦 | 自己重試 | — | **自動換引擎＋失敗頁一鍵重試** |
| 重新整理進度消失 | 會 | 會 | **不會——斷點續翻** |

---

## PDFluv2 好在哪

### 雙免費引擎自動容錯
翻整本書很容易把 Google 免費端點打到 429。PDFluv2 偵測到就自動切去 Bing 免費端點，還有冷卻機制，不會在被封鎖的引擎上浪費時間。

### 真正排版好的 PDF
不是 `.txt`。A4 版面、內嵌並 subset 過的 Noto Sans TC/SC 字型、自動頁碼、每頁原文標籤——205 頁的書輸出只有約 300 KB，文字可選取可搜尋。

### 逐段中英對照
每段英文原文（灰色小字）下面直接接中文翻譯。段落數萬一對不上，那頁自動退回整塊模式，不會錯位亂配。

### 進度摔不壞
每翻完一頁就存進 IndexedDB。重新整理、當機、關分頁——再打開會出現「繼續翻譯」橫幅，從斷點接著跑。

### 自帶 AI
填一組 OpenAI 相容的 key（OpenAI、DeepSeek、Groq⋯），選個模型就能用。Key 只存在你瀏覽器的 localStorage。

### 聰明的段落抽取
PDF 抽出來的文字是一行行斷開的。PDFluv2 先用行距 heuristic 把它們接回完整段落（含行尾連字號還原），翻譯引擎看到的是完整句子——翻譯品質直接跳一個檔次。

---

## 快速開始

```bash
git clone https://github.com/Jeffrey0117/pdfluv2.git
cd pdfluv2
npm install
npm run dev
# 打開 http://localhost:3000，把 PDF 拖進去
```

不需要任何環境變數。GPT key（選用）直接在介面上填。

---

## 架構

```
app/
  page.tsx                 主 UI（idle → 解析 → 翻譯 → 完成）
  api/translate/route.ts   翻譯代理（驗證＋限流）
  api/export-pdf/route.ts  排版 PDF 產生器
lib/
  extract.ts               pdf.js 抽字＋段落重組
  chunk.ts                 依句子切塊（≤3500 字元）
  translateClient.ts       逐頁翻譯調度
  storage.ts               IndexedDB 進度保存
  server/
    freeTranslate.ts       Google → Bing 容錯
    google.ts / bing.ts    免費引擎（重試＋token 快取）
    openai.ts              OpenAI 相容介接
    pdfDocument.tsx        @react-pdf/renderer 排版（中文斷行）
public/fonts/              Noto Sans TC/SC（TrueType，匯出時 subset）
```

流程：`PDF → pdf.js（在瀏覽器內）→ 段落 → /api/translate → 逐頁結果 → /api/export-pdf → 排版 PDF`

你的 PDF 檔不會離開瀏覽器——送出去翻譯的只有抽出來的文字。

---

## 設定

| 設定 | 位置 | 必填 | 說明 |
|---|---|---|---|
| 翻譯引擎 | 介面切換 | — | 免費（Google/Bing）或 AI（GPT） |
| 目標語言 | 介面 | — | 繁體中文／简体中文 |
| API Key | 介面，只存 localStorage | 只有 AI 模式需要 | 任何 OpenAI 相容服務 |
| Base URL / 模型 | 介面 | 選填 | 預設 `api.openai.com/v1`、`gpt-4o-mini` |

---

## Roadmap

- [x] 免費雙引擎自動容錯
- [x] 排版 PDF 匯出（純翻譯／逐段中英對照）
- [x] 斷點續翻（IndexedDB）
- [x] 背景預先產生 PDF（按下載秒拿）
- [ ] 掃描檔 OCR
- [ ] 更多語言組合
- [ ] EPUB 輸出

---

## License

MIT
