"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { authFetch, useLetMeUse } from "@/components/useLetMeUse";
import type { Book } from "@/lib/readerTypes";

interface DictEntry {
  word: string;
  phonetic: string;
  translation: string;
  base?: string;
}

interface Tip {
  x: number;
  y: number;
  word: string;
  sentence: string;
  pinned: boolean;
  entry: DictEntry | null | "loading";
  ai: string;
  aiLoading: boolean;
  saved: boolean;
}

const WORD_RE = /[A-Za-z'’-]/;

// 從文字節點座標抓出游標下的英文單字與所在句子
function wordAtPoint(x: number, y: number): { word: string; sentence: string } | null {
  type CaretPos = { offsetNode: Node; offset: number };
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPos | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const el = node.parentElement;
  if (!el || !el.closest("[data-en]")) return null;

  const text = node.textContent || "";
  if (!WORD_RE.test(text[offset] || "") && !WORD_RE.test(text[offset - 1] || "")) return null;
  let start = offset;
  let end = offset;
  while (start > 0 && WORD_RE.test(text[start - 1])) start--;
  while (end < text.length && WORD_RE.test(text[end])) end++;
  const word = text.slice(start, end).replace(/[’]/g, "'");
  if (!/[A-Za-z]{2,}/.test(word)) return null;

  // 句子邊界：在整段文字裡往前後找 .!? （含引號收尾）
  const para = el.closest("[data-en]")!.textContent || text;
  const globalIdx = para.indexOf(text.slice(start, end), Math.max(0, para.indexOf(text) >= 0 ? para.indexOf(text) + start : 0));
  const anchor = globalIdx >= 0 ? globalIdx : 0;
  let sStart = 0;
  for (let i = anchor; i > 0; i--) {
    if (/[.!?]/.test(para[i - 1]) && /[\s"'”’]/.test(para[i] || " ")) {
      sStart = i;
      break;
    }
  }
  let sEnd = para.length;
  for (let i = anchor; i < para.length; i++) {
    if (/[.!?]/.test(para[i])) {
      sEnd = Math.min(para.length, i + 1);
      break;
    }
  }
  const sentence = para.slice(sStart, sEnd).trim().slice(0, 500);
  return { word, sentence };
}

function splitParas(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading, login } = useLetMeUse();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [showZh, setShowZh] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [tip, setTip] = useState<Tip | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const fs = Number(localStorage.getItem("pdfluv-fontsize"));
      if (fs >= 14 && fs <= 26) setFontSize(fs);
      setShowZh(localStorage.getItem("pdfluv-showzh") !== "0");
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    authFetch(`/api/books/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBook(json.data.book);
        else setError(json.error || "載入失敗");
      })
      .catch(() => setError("載入失敗，請重新整理"));
  }, [user, id]);

  // 閱讀進度：捲動位置記憶與還原
  useEffect(() => {
    if (!book || restored.current) return;
    restored.current = true;
    const pos = Number(localStorage.getItem(`pdfluv-pos-${id}`));
    if (pos > 0) requestAnimationFrame(() => window.scrollTo(0, pos));
  }, [book, id]);

  useEffect(() => {
    if (!book) return;
    let timer: number | null = null;
    const onScroll = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          localStorage.setItem(`pdfluv-pos-${id}`, String(window.scrollY));
        } catch {}
      }, 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [book, id]);

  const setPref = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  };

  const openTip = useCallback(
    async (hit: { word: string; sentence: string }, x: number, y: number, pinned: boolean) => {
      setTip((prev) => {
        if (prev?.pinned && !pinned) return prev; // 釘住時 hover 不搶
        if (prev?.word === hit.word && prev.pinned && pinned) return prev;
        return { x, y, word: hit.word, sentence: hit.sentence, pinned, entry: "loading", ai: "", aiLoading: false, saved: false };
      });
      try {
        const res = await fetch(`/api/dict?w=${encodeURIComponent(hit.word)}`);
        const json = res.ok ? await res.json() : null;
        setTip((prev) =>
          prev && prev.word === hit.word ? { ...prev, entry: json?.success ? (json.data as DictEntry) : null } : prev
        );
      } catch {
        setTip((prev) => (prev && prev.word === hit.word ? { ...prev, entry: null } : prev));
      }
    },
    []
  );

  const handleClick = (e: React.MouseEvent) => {
    const hit = wordAtPoint(e.clientX, e.clientY);
    if (hit) {
      e.preventDefault();
      openTip(hit, e.clientX, e.clientY, true);
    } else if (tip?.pinned && !(e.target as HTMLElement).closest("[data-tip]")) {
      setTip(null);
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    if (tip?.pinned) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    const { clientX, clientY } = e;
    hoverTimer.current = window.setTimeout(() => {
      const hit = wordAtPoint(clientX, clientY);
      if (hit) openTip(hit, clientX, clientY, false);
      else setTip((prev) => (prev && !prev.pinned ? null : prev));
    }, 220);
  };

  const handleExplain = async () => {
    if (!tip || tip.aiLoading) return;
    const current = tip;
    setTip({ ...current, aiLoading: true });
    try {
      const res = await authFetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: current.word, sentence: current.sentence }),
      });
      const json = await res.json();
      setTip((prev) =>
        prev && prev.word === current.word
          ? { ...prev, aiLoading: false, ai: json.success ? json.data.answer : json.error || "AI 解釋失敗" }
          : prev
      );
    } catch {
      setTip((prev) => (prev && prev.word === current.word ? { ...prev, aiLoading: false, ai: "AI 解釋失敗" } : prev));
    }
  };

  const handleCollect = async () => {
    if (!tip || tip.saved) return;
    const entry = tip.entry !== "loading" ? tip.entry : null;
    const current = tip;
    try {
      const res = await authFetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: entry?.base || current.word,
          phonetic: entry?.phonetic || "",
          meaning: entry?.translation || "",
          sentence: current.sentence,
          bookTitle: book?.title || "",
        }),
      });
      const json = await res.json();
      if (json.success) setTip((prev) => (prev && prev.word === current.word ? { ...prev, saved: true } : prev));
    } catch {}
  };

  const tipStyle = tip
    ? {
        left: Math.min(tip.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 340) + "px",
        top: tip.y + 20 + "px",
      }
    : undefined;

  return (
    <>
      <SiteNav />

      {/* 閱讀工具列 */}
      <div className="sticky top-[53px] z-30 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-sm">
          <Link href="/shelf" className="text-neutral-500 hover:text-rose-500 dark:text-neutral-400">
            ← 書櫃
          </Link>
          <span className="min-w-0 flex-1 truncate font-medium text-neutral-700 dark:text-neutral-200">{book?.title || ""}</span>
          <button
            type="button"
            onClick={() => {
              setShowZh((v) => {
                setPref("pdfluv-showzh", v ? "0" : "1");
                return !v;
              });
            }}
            className={`rounded-full px-3 py-1 font-medium ${showZh ? "bg-rose-500 text-white" : "border border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"}`}
          >
            中文{showZh ? "開" : "關"}
          </button>
          <button
            type="button"
            onClick={() => setFontSize((v) => {
              const next = Math.max(14, v - 2);
              setPref("pdfluv-fontsize", String(next));
              return next;
            })}
            className="rounded-full border border-neutral-300 px-2.5 py-1 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setFontSize((v) => {
              const next = Math.min(26, v + 2);
              setPref("pdfluv-fontsize", String(next));
              return next;
            })}
            className="rounded-full border border-neutral-300 px-2.5 py-1 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            A＋
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {!isLoading && !user && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-500 dark:text-neutral-400">這本書在你的書櫃裡，登入後繼續讀。</p>
            <button type="button" onClick={login} className="rounded-full bg-rose-500 px-6 py-2 font-medium text-white hover:bg-rose-600">
              登入
            </button>
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {user && !book && !error && <p className="py-20 text-center text-neutral-400">載入中…</p>}

        {book && (
          <article onClick={handleClick} onMouseMove={handleMove} className="select-text">
            <p className="mb-8 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
              點任何英文單字 → 即時釋義；按「AI 解釋」看語境意思；按「收藏」存進生詞本。
            </p>
            {book.pages.map((page) => {
              const ens = splitParas(page.original);
              const zhs = splitParas(page.translated);
              const aligned = ens.length === zhs.length && ens.length > 0;
              return (
                <section key={page.pageNumber} className="mb-10">
                  <p className="mb-4 text-xs tracking-widest text-neutral-300 dark:text-neutral-600">— 第 {page.pageNumber} 頁 —</p>
                  {aligned
                    ? ens.map((en, i) => (
                        <div key={i} className="mb-5">
                          <p data-en style={{ fontSize }} className="cursor-pointer leading-relaxed text-neutral-900 dark:text-neutral-100">
                            {en}
                          </p>
                          {showZh && zhs[i] && (
                            <p style={{ fontSize: fontSize - 3 }} className="mt-1 leading-relaxed text-neutral-400 dark:text-neutral-500">
                              {zhs[i]}
                            </p>
                          )}
                        </div>
                      ))
                    : (
                      <>
                        {ens.map((en, i) => (
                          <p key={`e${i}`} data-en style={{ fontSize }} className="mb-4 cursor-pointer leading-relaxed text-neutral-900 dark:text-neutral-100">
                            {en}
                          </p>
                        ))}
                        {showZh && zhs.length > 0 && (
                          <div className="mt-2 border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-800">
                            {zhs.map((zh, i) => (
                              <p key={`z${i}`} style={{ fontSize: fontSize - 3 }} className="mb-3 leading-relaxed text-neutral-400 dark:text-neutral-500">
                                {zh}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                </section>
              );
            })}
          </article>
        )}
      </main>

      {/* 查字浮窗 */}
      {tip && (
        <div
          data-tip
          style={tipStyle}
          className="fixed z-50 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-neutral-900 dark:text-white">{tip.word}</span>
            {tip.entry !== "loading" && tip.entry?.phonetic && (
              <span className="text-xs text-neutral-400">/{tip.entry.phonetic}/</span>
            )}
            {tip.entry !== "loading" && tip.entry?.base && tip.entry.base !== tip.word.toLowerCase() && (
              <span className="text-xs text-neutral-400">→ {tip.entry.base}</span>
            )}
            {tip.pinned && (
              <button type="button" onClick={() => setTip(null)} className="ml-auto text-neutral-400 hover:text-neutral-600">
                ✕
              </button>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {tip.entry === "loading" ? "查詢中…" : tip.entry ? tip.entry.translation : "字典沒收這個字，試試 AI 解釋"}
          </p>
          {tip.pinned && (
            <>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={tip.aiLoading}
                  onClick={handleExplain}
                  className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {tip.aiLoading ? "AI 思考中…" : "AI 解釋這句"}
                </button>
                <button
                  type="button"
                  disabled={tip.saved}
                  onClick={handleCollect}
                  className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:hover:bg-rose-950/40"
                >
                  {tip.saved ? "已收藏 ✓" : "☆ 收藏生詞"}
                </button>
              </div>
              {tip.ai && (
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-rose-50 p-3 text-sm leading-relaxed text-neutral-700 dark:bg-rose-950/30 dark:text-neutral-200">
                  {tip.ai}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
