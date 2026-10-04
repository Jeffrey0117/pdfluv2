"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { authFetch, useLetMeUse } from "@/components/useLetMeUse";
import type { VocabItem } from "@/lib/readerTypes";

export default function VocabPage() {
  const { user, isLoading, login } = useLetMeUse();
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/vocab")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setItems(json.data.items);
        else setError(json.error || "載入失敗");
      })
      .catch(() => setError("載入失敗，請重新整理"));
  }, [user]);

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/vocab?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  };

  // 生成個人化講義 PDF：AI 為每個生詞補用法筆記
  const handleHandout = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await authFetch("/api/handout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "講義產生失敗");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "我的生詞講義.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "講義產生失敗");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-neutral-900 dark:text-white">生詞本</h1>
          {items && items.length > 0 && (
            <button
              type="button"
              disabled={generating}
              onClick={handleHandout}
              className="ml-auto rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
            >
              {generating ? "AI 整理講義中…（約 10 秒）" : "生成講義 PDF（AI 補用法筆記）"}
            </button>
          )}
        </div>

        {!isLoading && !user && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-500 dark:text-neutral-400">登入後，閱讀時收藏的生詞都在這裡，一鍵變成講義。</p>
            <button type="button" onClick={login} className="rounded-full bg-rose-500 px-6 py-2 font-medium text-white hover:bg-rose-600">
              登入 / 註冊
            </button>
          </div>
        )}

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        {user && items && items.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            還沒有收藏任何生詞。打開書櫃裡的書，點單字 → 收藏，就會出現在這裡。
          </div>
        )}

        <div className="space-y-3">
          {(items || []).map((item) => (
            <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold text-neutral-900 dark:text-white">{item.word}</span>
                {item.phonetic && <span className="text-xs text-neutral-400">/{item.phonetic}/</span>}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="ml-auto text-xs text-neutral-400 hover:text-red-500"
                >
                  移除
                </button>
              </div>
              {item.meaning && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{item.meaning}</p>}
              {item.sentence && (
                <p className="mt-2 border-l-2 border-rose-200 pl-3 text-sm italic text-neutral-500 dark:border-rose-900 dark:text-neutral-400">
                  {item.sentence}
                  {item.bookTitle && <span className="not-italic">（{item.bookTitle}）</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
