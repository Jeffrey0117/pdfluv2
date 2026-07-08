"use client";

import type { Provider, TargetLang, TranslateSettings } from "@/lib/types";

interface ProviderSettingsProps {
  settings: TranslateSettings;
  disabled: boolean;
  onChange: (next: TranslateSettings) => void;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-rose-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function ProviderSettings({ settings, disabled, onChange }: ProviderSettingsProps) {
  const update = (patch: Partial<TranslateSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          翻譯引擎
        </span>
        {(
          [
            { value: "google", label: "免費翻譯（Google / Bing 自動切換）" },
            { value: "openai", label: "AI 翻譯（GPT / 相容 API）" },
          ] as Array<{ value: Provider; label: string }>
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => update({ provider: opt.value })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              settings.provider === opt.value
                ? "bg-rose-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        ))}

        <span className="ml-auto flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          目標語言
          <select
            value={settings.targetLang}
            disabled={disabled}
            onChange={(e) => update({ targetLang: e.target.value as TargetLang })}
            className={`${inputClass} !w-auto`}
          >
            <option value="zh-TW">繁體中文</option>
            <option value="zh-CN">簡體中文</option>
          </select>
        </span>
      </div>

      {settings.provider === "openai" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm text-neutral-600 dark:text-neutral-300">
            API Key（只存在你的瀏覽器）
            <input
              type="password"
              value={settings.apiKey}
              disabled={disabled}
              placeholder="sk-..."
              onChange={(e) => update({ apiKey: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm text-neutral-600 dark:text-neutral-300">
            模型
            <input
              type="text"
              value={settings.model}
              disabled={disabled}
              placeholder="gpt-4o-mini"
              onChange={(e) => update({ model: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm text-neutral-600 dark:text-neutral-300">
            Base URL（相容 API 可改）
            <input
              type="text"
              value={settings.baseUrl}
              disabled={disabled}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => update({ baseUrl: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
