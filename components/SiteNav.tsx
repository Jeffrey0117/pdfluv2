"use client";

import Link from "next/link";
import { useLetMeUse } from "@/components/useLetMeUse";

export function SiteNav() {
  const { user, isLoading, login, openProfile } = useLetMeUse();

  return (
    <nav className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
          PDF<span className="text-rose-500">luv2</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href="/shelf"
            className="rounded-full px-3 py-1.5 font-medium text-neutral-600 hover:bg-neutral-100 hover:text-rose-500 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            我的書櫃
          </Link>
          <Link
            href="/vocab"
            className="rounded-full px-3 py-1.5 font-medium text-neutral-600 hover:bg-neutral-100 hover:text-rose-500 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            生詞本
          </Link>
          {!isLoading && !user && (
            <button
              type="button"
              onClick={login}
              className="ml-1 rounded-full bg-rose-500 px-4 py-1.5 font-medium text-white hover:bg-rose-600"
            >
              登入
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={openProfile}
              title={user.displayName || user.email}
              className="ml-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-bold text-rose-600 dark:bg-rose-950"
            >
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (user.displayName || user.email || "?").slice(0, 1).toUpperCase()
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
