"use client";

import type { PageTranslation } from "@/lib/types";

const STATUS_LABELS: Record<PageTranslation["status"], string> = {
  pending: "等待中",
  translating: "翻譯中…",
  done: "完成",
  error: "失敗",
};

const STATUS_STYLES: Record<PageTranslation["status"], string> = {
  pending: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  translating: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

interface PageCardProps {
  page: PageTranslation;
  onRetry: (pageNumber: number) => void;
}

export function PageCard({ page, onRetry }: PageCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          第 {page.pageNumber} 頁
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[page.status]}`}>
          {STATUS_LABELS[page.status]}
        </span>
        {page.status === "error" && (
          <button
            type="button"
            onClick={() => onRetry(page.pageNumber)}
            className="ml-auto rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600"
          >
            重試
          </button>
        )}
      </header>

      {page.status === "error" && page.error && (
        <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {page.error}
        </p>
      )}

      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-neutral-100 p-5 md:border-b-0 md:border-r dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">原文</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {page.original || "（此頁沒有可擷取的文字）"}
          </p>
        </div>
        <div className="p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-rose-400">中文翻譯</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-100">
            {page.translated || (page.status === "done" ? "（無內容）" : "…")}
          </p>
        </div>
      </div>
    </section>
  );
}
