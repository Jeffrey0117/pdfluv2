"use client";

import type { WordBankSettings } from "@/lib/types";

const EXAM_OPTIONS = [
  { tag: "cet4", label: "CET4" },
  { tag: "cet6", label: "CET6" },
  { tag: "toefl", label: "TOEFL" },
  { tag: "ielts", label: "IELTS" },
  { tag: "gre", label: "GRE" },
];

const FREQ_MIN = 1000;
const FREQ_MAX = 20000;
const FREQ_STEP = 1000;

interface WordBankPanelProps {
  value: WordBankSettings;
  disabled: boolean;
  onChange: (next: WordBankSettings) => void;
}

export function WordBankPanel({ value, disabled, onChange }: WordBankPanelProps) {
  const toggleTag = (tag: string) => {
    const tags = value.tags.includes(tag)
      ? value.tags.filter((t) => t !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags });
  };

  return (
    <div className="w-full space-y-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="h-4 w-4 accent-rose-500"
        />
        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
          學習版：難字標註 + Word Bank
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          只套用在「學習版 PDF」— 難字標紅底線，每頁附單字區（音標、中譯、原書例句）
        </span>
      </label>

      {value.enabled && (
        <div className="space-y-3 rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">考試字表：</span>
            {EXAM_OPTIONS.map(({ tag, label }) => (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  value.tags.includes(tag)
                    ? "bg-rose-500 text-white"
                    : "border border-neutral-300 text-neutral-500 hover:border-rose-300 dark:border-neutral-600 dark:text-neutral-400"
                } disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              略過最常用的 {value.minFreqRank.toLocaleString()} 字：
            </span>
            <input
              type="range"
              min={FREQ_MIN}
              max={FREQ_MAX}
              step={FREQ_STEP}
              value={value.minFreqRank}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, minFreqRank: Number(e.target.value) })}
              className="min-w-40 flex-1 accent-rose-500"
            />
            <span className="text-xs text-neutral-400">
              {value.minFreqRank <= 3000 ? "標得多" : value.minFreqRank >= 10000 ? "只標很難的" : "適中"}
            </span>
          </div>

          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            勾了考試：標「該考試字表內、且不在常用字範圍」的字；超冷門字（如 beeswax）沒在字表也會標。
          </p>
        </div>
      )}
    </div>
  );
}
