# PDFluv2 閱讀模式（原文書線上學習工具）

> 2026-10-04 Jeff 核准 MVP。背景：英文教學短講的主軸 —「讀小說卡住 → PDFluv2 雙語書
> 還不夠 → 我把它變成閱讀工具」。轉檔維持免登入；會員只在「留下東西」時出現。

## MVP 範圍（五件事）

1. **書櫃**：轉好的書存進帳號（LetMeUse 會員），`/shelf` 列表。
2. **線上閱讀視圖** `/read/{bookId}`：雙語對照（中文可逐段顯示/隱藏）、字級調整、
   夜間模式、進度記憶。
3. **查單字**：滑過/點選英文單字 → 即時釋義 tooltip（ECDICT 精簡版，本地 JSON，
   server 記憶體查詢）；「AI 解釋」按鈕 → 這個詞在這句的語境解釋（Groq）。
4. **收藏生詞**：一鍵收藏（存 word + 釋義 + 書名 + 上下文句子），`/vocab` 生詞本。
5. **個人化講義**：生詞本一鍵「生成講義 PDF」— AI 為每個詞補用法筆記，
   走既有 react-pdf 匯出管線。

## 架構

- **沿用**：前端抽字（pdfjs）、/api/translate、/api/export-pdf、IndexedDB 進度。
- **新增 server 端**（Next.js route handlers，資料存 `data/` 下 fs JSON，gitignore）：
  - `lib/server/auth.ts`：LetMeUse JWT 驗證（JWKS，比照 wemeet 零依賴作法）。
  - `lib/server/store.ts`：fs JSON 原子讀寫（books/{sub}/{bookId}.json、vocab/{sub}.json）。
  - `app/api/books`（GET 列表/POST 存書）、`app/api/books/[id]`（GET/DELETE）、
    `app/api/dict?w=`（ECDICT 查詢，含簡單變形還原）、`app/api/explain`（Groq 語境解釋）、
    `app/api/vocab`（GET/POST/DELETE）、`app/api/handout`（AI 筆記 + PDF）。
- **詞典資料**：ECDICT 以頻率欄位（collins/bnc/frq）濾出常用詞 → `data/dict.json`
  （進 repo，數 MB），server 啟動載入記憶體 Map。
- **前端新頁**：`/shelf`、`/read/[id]`、`/vocab`；主頁轉檔完成區加「存進書櫃」
  （未登入 → LetMeUse modal）。
- **會員**：LetMeUse SDK（script tag，app 專屬 appId）；API 以 Bearer access token 驗。

## 隱私與定位

轉檔流程完全不變（檔案不上傳、免登入）。「存進書櫃」才會把**抽出的文字與譯文**
（非原始 PDF）送到伺服器，UI 明講這點。

## 部署

cloudpipe 新專案 `pdfluv`，port 4051，網域見部署環境設定，照 cloudpipe-deploy
skill 的 NEW project 步驟（repo 已 public、手動鋪 workhub、補 CF DNS、env 注入
GROQ_API_KEY + LETMEUSE_*）。buildCommand 用 `npm install --include=dev && npm run build`。

## 驗證

本地 dev：轉一份小 PDF → 存書櫃 → 閱讀視圖 hover 查字/AI 解釋 → 收藏 → 生詞本 →
生成講義 PDF。部署後同一條線上流程走一遍（用 Jeff 的會員帳號）。
