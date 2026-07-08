"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  disabled: boolean;
  onFileSelected: (file: File) => void;
}

export function UploadZone({ disabled, onFileSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        alert("請選擇 PDF 檔案");
        return;
      }
      onFileSelected(file);
    },
    [disabled, onFileSelected]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
        dragging
          ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
          : "border-neutral-300 bg-white hover:border-rose-300 hover:bg-rose-50/50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className="text-5xl" aria-hidden>
        📄
      </span>
      <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
        把 PDF 拖進來，或點擊選擇檔案
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        英文 PDF → 中文翻譯，檔案只在你的瀏覽器解析，不會上傳原檔
      </p>
    </div>
  );
}
