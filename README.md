<p align="center">
  <img src="app/icon.svg" alt="PDFluv2" width="96" />
</p>
<h1 align="center">PDFluv2</h1>
<p align="center">
  <strong>Drop an English PDF. Get back a Chinese book.</strong>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
</p>
<p align="center">
  English | <a href="README.zh-TW.md">繁體中文</a>
</p>

---

## Picture This

You just found a 205-page English business book in PDF. You drag it onto PDFluv2. Pages start turning green, one by one. A few minutes later you click one button — and download a cleanly typeset Chinese PDF, with page numbers, embedded fonts, and every paragraph readable. Or the bilingual edition: each English paragraph followed by its translation, like a real parallel-text book.

No account. No upload of your file to anyone's server. No API key required.

---

## Why Not Just Use...?

|  | Google Translate (docs) | Paste into ChatGPT | **PDFluv2** |
|---|---|---|---|
| Whole-book PDFs | 10 MB / formatting breaks | Paste limit, page by page | **Any size, page by page automatically** |
| Output | Messy HTML-ish page | Chat bubbles | **Typeset PDF (translated or bilingual)** |
| Cost | Free | Subscription for volume | **Free (Google/Bing) or your own GPT key** |
| Rate-limit handling | You retry manually | — | **Auto engine fallback + one-click retry** |
| Lose progress on refresh | Yes | Yes | **No — resumes from where it stopped** |

---

## What Makes PDFluv2 Nice

### Dual free engines with automatic failover
Google Translate's free endpoint gets rate-limited if you translate a whole book. PDFluv2 detects the 429 and silently switches to Bing's free endpoint, with a cooldown so it never wastes time on a blocked engine.

### Real typeset PDF output
Not a `.txt` dump. A4 pages, embedded (and subsetted) Noto Sans TC/SC fonts, page numbers, per-source-page labels — a 205-page book exports to a ~300 KB PDF with selectable text.

### Paragraph-aligned bilingual mode
Each source paragraph in gray, its translation right below. If paragraph counts ever mismatch, that page falls back to block layout instead of misaligning.

### Crash-proof progress
Every finished page is saved to IndexedDB. Refresh, crash, close the tab — reopen and you get a "continue where you left off" banner.

### Bring your own AI
Fill in an OpenAI-compatible key (OpenAI, DeepSeek, Groq...), pick a model, done. The key lives only in your browser's localStorage.

### Smart paragraph extraction
PDF text comes out as broken visual lines. PDFluv2 re-merges them into full paragraphs (line-gap heuristics + hyphen joining) before translating, so the translator sees complete sentences — quality jumps dramatically.

---

## Quick Start

```bash
git clone https://github.com/Jeffrey0117/pdfluv2.git
cd pdfluv2
npm install
npm run dev
# open http://localhost:3000, drop a PDF
```

No environment variables needed. The optional GPT key is entered in the UI.

---

## Architecture

```
app/
  page.tsx                 main UI (idle → extract → translate → done)
  api/translate/route.ts   translation proxy (validation + rate limit)
  api/export-pdf/route.ts  typeset PDF generator
lib/
  extract.ts               pdf.js text extraction + paragraph re-merging
  chunk.ts                 sentence-aware chunking (≤3500 chars)
  translateClient.ts       per-page translation orchestration
  storage.ts               IndexedDB progress persistence
  server/
    freeTranslate.ts       Google → Bing failover
    google.ts / bing.ts    free engine adapters (retry + token cache)
    openai.ts              OpenAI-compatible adapter
    pdfDocument.tsx        @react-pdf/renderer layout (CJK line breaking)
public/fonts/              Noto Sans TC/SC (TrueType, subset on export)
```

Flow: `PDF → pdf.js (in browser) → paragraphs → /api/translate → per-page results → /api/export-pdf → typeset PDF`

Your PDF never leaves the browser — only extracted text is sent for translation.

---

## Configuration

| Setting | Where | Required | Notes |
|---|---|---|---|
| Engine | UI toggle | — | Free (Google/Bing) or AI (GPT) |
| Target language | UI | — | 繁體中文 / 简体中文 |
| API key | UI, localStorage only | Only for AI mode | Any OpenAI-compatible provider |
| Base URL / model | UI | Optional | Defaults: `api.openai.com/v1`, `gpt-4o-mini` |

---

## Roadmap

- [x] Free dual-engine translation with failover
- [x] Typeset PDF export (translated / paragraph-aligned bilingual)
- [x] Resume after refresh (IndexedDB)
- [x] Background PDF pre-generation (instant download)
- [ ] OCR for scanned PDFs
- [ ] More language pairs
- [ ] EPUB output

---

## License

MIT
