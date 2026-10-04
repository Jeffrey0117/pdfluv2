"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { authFetch, useLetMeUse } from "@/components/useLetMeUse";
import type { BookMeta } from "@/lib/readerTypes";

export default function ShelfPage() {
  const { user, isLoading, login } = useLetMeUse();
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    authFetch("/api/books")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBooks(json.data.books);
        else setError(json.error || "載入失敗");
      })
      .catch(() => setError("載入失敗，請重新整理"));
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除這本書？閱讀進度也會一起消失。")) return;
    const res = await authFetch(`/api/books/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) setBooks((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
  };

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-black text-neutral-900 dark:text-white">我的書櫃</h1>

        {!isLoading && !user && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-500 dark:text-neutral-400">登入後，翻譯好的書都存在這裡，隨時接著讀。</p>
            <button
              type="button"
              onClick={login}
              className="rounded-full bg-rose-500 px-6 py-2 font-medium text-white hover:bg-rose-600"
            >
              登入 / 註冊
            </button>
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        {user && books && books.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-500 dark:text-neutral-400">書櫃還是空的。去翻譯一本書，按「存進書櫃」就會出現在這裡。</p>
            <Link href="/" className="rounded-full bg-rose-500 px-6 py-2 font-medium text-white hover:bg-rose-600">
              去翻譯一本書 →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {(books || []).map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/read/${book.id}`}
                  className="block truncate font-semibold text-neutral-800 hover:text-rose-500 dark:text-neutral-100"
                >
                  {book.title}
                </Link>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {book.pageCount} 頁 · 存於 {book.createdAt.slice(0, 10)}
                </p>
              </div>
              <Link
                href={`/read/${book.id}`}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
              >
                開始閱讀
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(book.id)}
                className="rounded-full border border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
