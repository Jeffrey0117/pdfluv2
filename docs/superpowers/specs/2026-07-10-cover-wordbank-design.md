# PDFluv2:自訂封面 + 難字 Word Bank 設計

日期:2026-07-10 · 狀態:已與使用者確認

## 功能一:自訂封面

使用者上傳一張圖(通常是網路上找的書封),成為匯出 PDF 的第一頁。

- **UI**:匯出區新增「上傳封面」按鈕 + 縮圖預覽 + 移除按鈕。
- **前端處理**:canvas 縮圖(最長邊 2000px)、統一轉 JPEG(quality 0.85)→ data URL。
  解決 webp/HEIC 不支援與超大圖問題(react-pdf 僅支援 JPG/PNG)。
- **持久化**:封面存 IndexedDB(與翻譯進度同一套 storage),重新整理不遺失。
- **API**:`POST /api/export-pdf` payload 新增 `coverImage?: string`(data URL)。
  伺服器驗證:`data:image/jpeg|png;base64,` 前綴、解碼後 ≤ 8MB,不合法回 400。
- **PDF**:第一頁滿版出血(`objectFit: cover` 填滿 A4,無 padding、無頁碼、無 header);
  原書名 header 頁從第二頁開始,頁碼從內文起算。

## 功能二:難字標註 + 每頁 Word Bank

### 資料:`lib/server/wordbank.json`(建置時產生,commit 進 repo)

一次性腳本 `scripts/build-wordbank.mjs` 從 ECDICT(開源 77 萬字英漢辭典,MIT)抽出:

- 收錄條件:有考試標籤(cet4/cet6/toefl/ielts/gre)或 COCA 詞頻 ≤ 30000
- 每字欄位:`word`、`phonetic`、`defs`(繁體,OpenCC s2t 轉換;另存 `defsSc` 簡體)、
  `tags`(考試標籤)、`frq`(詞頻排名)、`exchange`(變化形,ECDICT 自帶,
  用來做 lied→lie、running→run 的還原查表)
- 產出目標:數 MB 以內的 JSON;伺服器啟動時載入一次(module scope cache)

### 難度選擇(UI,存 localStorage)

- 考試勾選:CET4 / CET6 / TOEFL / IELTS / GRE(可複選)
- 詞頻門檻滑桿:「排名 N 以外的字才算難字」(預設 5000)
- 命中規則:字的 `tags` ∩ 勾選集合 非空,**或** `frq > 門檻`;
  排除:專有名詞(原文中首字母大寫且非句首)、長度 < 3 的字

### 標註與渲染(伺服器,匯出時)

- `/api/export-pdf` payload 新增
  `wordBank?: { enabled: boolean; tags: string[]; minFreqRank: number }`
- 掃描每頁 `original`:斷句 → 斷詞 → 查 wordbank(含變化形還原)→ 命中清單
- **原文標註**:命中字渲染為 Times-Bold + 紅色底線(nested `<Text>`;
  若 react-pdf `textDecorationColor` 不可用,退回整字紅色粗體+底線)
- **Word Bank 區塊**:每個原文頁段落之後,細線框標題「WORD BANK」,每字一列:
  單字(粗體)· 音標(灰)· 考試標籤(小字)· 中文釋義 · 例句(斜體 Times-Italic,
  例句 = 該字在本頁出現的完整句子,字內粗體標紅)
- **去重**:全書每次出現都標底線;word bank 僅在該字**第一次出現的頁**收錄
- **模式**:bilingual = 標註 + word bank;translated = 僅 word bank(無英文原文可標)
- zh-CN 匯出用簡體釋義(`defsSc`),zh-TW 用繁體

## 動工順序

1. 封面(UI + API + PDF)
2. `scripts/build-wordbank.mjs` 產生 wordbank.json
3. 伺服器標註邏輯 + PDF word bank 排版
4. UI 難度設定
5. 每步以 preview server(http://localhost:4747)給使用者驗收

## 不做(YAGNI)

- 網頁閱讀畫面的難字標註(只做 PDF)
- TOEIC 字表(ECDICT 無原生標籤,之後可掛第三方字表)
- AI 精選難字(架構留 `wordBank` 參數擴充空間即可)
- 片語/慣用語偵測
