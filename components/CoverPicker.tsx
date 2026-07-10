"use client";

import { useRef, useState } from "react";
import { fileToCoverDataUrl } from "@/lib/cover";

interface CoverPickerProps {
  cover: string | null;
  disabled: boolean;
  onChange: (cover: string | null) => void;
}

export function CoverPicker({ cover, disabled, onChange }: CoverPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    setError("");
    try {
      onChange(await fileToCoverDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "封面處理失敗");
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt="封面預覽"
            className="h-20 w-14 rounded-md border border-neutral-200 object-cover shadow-sm dark:border-neutral-700"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              封面已設定
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              會成為 PDF 的第一頁（滿版）
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            更換
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            移除
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:border-rose-300 hover:text-rose-500 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400"
        >
          <svg
            aria-hidden
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          上傳封面（可選，會成為 PDF 第一頁）
        </button>
      )}

      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </div>
  );
}
