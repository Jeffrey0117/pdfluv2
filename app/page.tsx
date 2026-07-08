"use client";

import { useEffect, useRef, useState } from "react";
import { PageCard } from "@/components/PageCard";
import { ProviderSettings } from "@/components/ProviderSettings";
import { UploadZone } from "@/components/UploadZone";
import { downloadTranslation, fetchPdfBlob, savePdfBlob, type PdfMode } from "@/lib/download";
import { extractPdfPages } from "@/lib/extract";
import { clearSession, loadSession, saveSession, type SavedSession } from "@/lib/storage";
import { translatePageText } from "@/lib/translateClient";
import { DEFAULT_SETTINGS, type PageTranslation, type TranslateSettings } from "@/lib/types";

type Phase = "idle" | "extracting" | "translating" | "done";

const SETTINGS_KEY = "pdflove-settings";

function loadSettings(): TranslateSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Home() {
  const [settings, setSettings] = useState<TranslateSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageTranslation[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [exporting, setExporting] = useState<PdfMode | null>(null);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [readyPdf, setReadyPdf] = useState<{ key: number; blob: Blob } | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    setSettings(loadSettings());
    loadSession()
      .then((session) => {
        if (session && session.pages.length > 0) setSaved(session);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pages.length === 0 || fileName.length === 0) return;
    const timer = setTimeout(() => {
      saveSession({ fileName, savedAt: Date.now(), pages }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [pages, fileName]);

  const updateSettings = (next: TranslateSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // localStorage 不可用時設定僅存在記憶體
    }
  };

  const setPage = (pageNumber: number, patch: Partial<PageTranslation>) => {
    setPages((prev) => prev.map((p) => (p.pageNumber === pageNumber ? { ...p, ...patch } : p)));
  };

  const translateAll = async (targets: PageTranslation[], runId: number) => {
    for (const page of targets) {
      if (runIdRef.current !== runId) return;
      if (page.original.trim().length === 0) {
        setPage(page.pageNumber, { status: "done", translated: "" });
        continue;
      }
      setPage(page.pageNumber, { status: "translating", error: undefined });
      try {
        const translated = await translatePageText(page.original, settings);
        if (runIdRef.current !== runId) return;
        setPage(page.pageNumber, { status: "done", translated });
      } catch (error) {
        if (runIdRef.current !== runId) return;
        const message = error instanceof Error ? error.message : "翻譯失敗";
        setPage(page.pageNumber, { status: "error", error: message });
      }
    }
  };

  const handleFile = async (file: File) => {
    if (settings.provider === "openai" && settings.apiKey.trim().length === 0) {
      setGlobalError("你選了 AI 翻譯，請先填入 API Key，或改用免費的 Google 翻譯。");
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setGlobalError("");
    setSaved(null);
    setReadyPdf(null);
    setFileName(file.name.replace(/\.pdf$/i, ""));
    setPhase("extracting");
    setPages([]);

    let extractedPages: PageTranslation[];
    try {
      const { pages: texts } = await extractPdfPages(file);
      extractedPages = texts.map((original, i) => ({
        pageNumber: i + 1,
        original,
        translated: "",
        status: "pending" as const,
      }));
    } catch (error) {
      console.error("PDF 解析失敗:", error);
      setGlobalError("PDF 解析失敗，請確認檔案沒有加密或損壞。");
      setPhase("idle");
      return;
    }

    if (runIdRef.current !== runId) return;
    setPages(extractedPages);
    setPhase("translating");
    await translateAll(extractedPages, runId);
    if (runIdRef.current === runId) setPhase("done");
  };

  const handleRetry = async (pageNumber: number) => {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    if (!page) return;
    const runId = runIdRef.current;
    setPage(pageNumber, { status: "translating", error: undefined });
    try {
      const translated = await translatePageText(page.original, settings);
      if (runIdRef.current !== runId) return;
      setPage(pageNumber, { status: "done", translated });
    } catch (error) {
      if (runIdRef.current !== runId) return;
      setPage(pageNumber, {
        status: "error",
        error: error instanceof Error ? error.message : "翻譯失敗",
      });
    }
  };

  const handleExportPdf = async (mode: PdfMode) => {
    if (exporting) return;
    const baseName = fileName || "pdfluv2";
    if (mode === "translated" && readyPdf && readyPdf.key === donePages.length) {
      savePdfBlob(baseName, mode, readyPdf.blob);
      return;
    }
    setExporting(mode);
    setGlobalError("");
    try {
      const blob = await fetchPdfBlob(baseName, donePages, mode, settings.targetLang);
      if (mode === "translated") setReadyPdf({ key: donePages.length, blob });
      savePdfBlob(baseName, mode, blob);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "PDF 產生失敗");
    } finally {
      setExporting(null);
    }
  };

  const handleResume = async () => {
    if (!saved) return;
    const restored = saved.pages.map((p) =>
      p.status === "done" ? p : { ...p, status: "pending" as const, error: undefined }
    );
    setSaved(null);
    setGlobalError("");
    setReadyPdf(null);
    setFileName(saved.fileName);
    setPages(restored);

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const remaining = restored.filter((p) => p.status !== "done");
    if (remaining.length === 0) {
      setPhase("done");
      return;
    }
    setPhase("translating");
    await translateAll(remaining, runId);
    if (runIdRef.current === runId) setPhase("done");
  };

  const handleDiscardSaved = () => {
    setSaved(null);
    clearSession().catch(() => {});
  };

  const handleReset = () => {
    runIdRef.current += 1;
    setPhase("idle");
    setPages([]);
    setFileName("");
    setGlobalError("");
    setReadyPdf(null);
    clearSession().catch(() => {});
  };

  const doneCount = pages.filter((p) => p.status === "done").length;
  const failedPages = pages.filter((p) => p.status === "error");
  const busy = phase === "extracting" || phase === "translating";
  const donePages = pages.filter((p) => p.status === "done" && p.translated.length > 0);

  const handleRetryFailed = async () => {
    for (const page of failedPages) {
      await handleRetry(page.pageNumber);
    }
  };

  useEffect(() => {
    if (phase !== "done" || donePages.length === 0) return;
    const key = donePages.length;
    if (readyPdf?.key === key) return;

    let cancelled = false;
    fetchPdfBlob(fileName || "pdfluv2", donePages, "translated", settings.targetLang)
      .then((blob) => {
        if (!cancelled) setReadyPdf({ key, blob });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pages, readyPdf, fileName, settings.targetLang]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
          PDF<span className="text-rose-500">luv2</span>
        </h1>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          丟一份英文 PDF，整份翻成中文。免費 Google 翻譯，或接你自己的 GPT key。
        </p>
      </header>

      <div className="space-y-4">
        <ProviderSettings settings={settings} disabled={busy} onChange={updateSettings} />

        {phase === "idle" && saved && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-800 dark:text-neutral-100">
                上次未完成的翻譯：{saved.fileName}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                已完成 {saved.pages.filter((p) => p.status === "done").length} / {saved.pages.length} 頁，可以接著翻
              </p>
            </div>
            <button
              type="button"
              onClick={handleResume}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
            >
              繼續翻譯
            </button>
            <button
              type="button"
              onClick={handleDiscardSaved}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              捨棄
            </button>
          </div>
        )}

        {phase === "idle" && <UploadZone disabled={busy} onFileSelected={handleFile} />}

        {globalError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
            {globalError}
          </p>
        )}

        {phase !== "idle" && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-800 dark:text-neutral-100">
                {fileName || "文件"}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {phase === "extracting" && "正在解析 PDF…"}
                {phase === "translating" &&
                  `翻譯中：${doneCount} / ${pages.length} 頁（想要完整 PDF 請等全部跑完）`}
                {phase === "done" &&
                  `完成：${doneCount} / ${pages.length} 頁${
                    failedPages.length > 0 ? `，${failedPages.length} 頁失敗（可一鍵重試）` : ""
                  }`}
              </p>
            </div>

            {pages.length > 0 && (
              <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${(doneCount / pages.length) * 100}%` }}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!busy && failedPages.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  重試失敗頁（{failedPages.length}）
                </button>
              )}
              {donePages.length > 0 && (
                <>
                  <button
                    type="button"
                    disabled={exporting !== null}
                    onClick={() => handleExportPdf("translated")}
                    className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                  >
                    {exporting === "translated"
                      ? "產生中…"
                      : phase === "done"
                        ? readyPdf?.key === donePages.length
                          ? "下載翻譯 PDF（已就緒）"
                          : "下載翻譯 PDF"
                        : `部分翻譯 PDF（${doneCount}/${pages.length}）`}
                  </button>
                  <button
                    type="button"
                    disabled={exporting !== null}
                    onClick={() => handleExportPdf("bilingual")}
                    className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-700"
                  >
                    {exporting === "bilingual"
                      ? "產生中…"
                      : phase === "done"
                        ? "中英對照 PDF"
                        : `部分對照 PDF（${doneCount}/${pages.length}）`}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTranslation(fileName || "pdfluv2", donePages)}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    .txt
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                換一份 PDF
              </button>
            </div>

            {exporting !== null && (
              <p className="w-full text-sm text-neutral-500 dark:text-neutral-400">
                正在排版產生 PDF，整本書可能需要 30 秒～2 分鐘，請別關閉頁面…
              </p>
            )}
          </div>
        )}

        {pages.map((page) => (
          <PageCard key={page.pageNumber} page={page} onRetry={handleRetry} />
        ))}
      </div>

      <footer className="mt-12 text-center text-xs text-neutral-400">
        PDF 只在你的瀏覽器解析；翻譯時僅將文字內容送到翻譯服務。API Key 只存在你的 localStorage。
      </footer>
    </main>
  );
}
