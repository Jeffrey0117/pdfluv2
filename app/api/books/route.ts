import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireUser } from "@/lib/server/auth";
import { bookDir, listJsonFiles, newId, readJson, writeJsonAtomic } from "@/lib/server/store";
import { checkRateLimit } from "@/lib/server/rateLimit";
import type { Book, BookMeta, BookPage } from "@/lib/readerTypes";

const MAX_BOOKS = 50;
const MAX_PAGES = 2000;
const MAX_PAGE_CHARS = 40_000;
const MAX_TOTAL_CHARS = 4_000_000;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });

  const files = await listJsonFiles(bookDir(user.sub));
  const metas: BookMeta[] = [];
  for (const file of files) {
    const book = await readJson<Book | null>(file, null);
    if (book) metas.push({ id: book.id, title: book.title, pageCount: book.pageCount, createdAt: book.createdAt });
  }
  metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ success: true, data: { books: metas } });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit("books:" + ip)) {
    return NextResponse.json({ success: false, error: "請求太頻繁" }, { status: 429 });
  }
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { title?: unknown; pages?: unknown } | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ success: false, error: "缺少書名" }, { status: 400 });
  }
  if (!Array.isArray(body.pages) || body.pages.length === 0 || body.pages.length > MAX_PAGES) {
    return NextResponse.json({ success: false, error: `pages 必須是 1 至 ${MAX_PAGES} 筆` }, { status: 400 });
  }

  let total = 0;
  const pages: BookPage[] = [];
  for (const raw of body.pages) {
    const p = raw as Record<string, unknown>;
    const original = typeof p.original === "string" ? p.original.slice(0, MAX_PAGE_CHARS) : "";
    const translated = typeof p.translated === "string" ? p.translated.slice(0, MAX_PAGE_CHARS) : "";
    total += original.length + translated.length;
    if (total > MAX_TOTAL_CHARS) {
      return NextResponse.json({ success: false, error: "內容太大，無法存進書櫃" }, { status: 413 });
    }
    pages.push({ pageNumber: Number(p.pageNumber) || pages.length + 1, original, translated });
  }

  const existing = await listJsonFiles(bookDir(user.sub));
  if (existing.length >= MAX_BOOKS) {
    return NextResponse.json({ success: false, error: `書櫃已滿（上限 ${MAX_BOOKS} 本），請先刪除舊書` }, { status: 400 });
  }

  const book: Book = {
    id: newId(),
    title: body.title.trim().slice(0, 200),
    pageCount: pages.length,
    createdAt: new Date().toISOString(),
    pages,
  };
  await writeJsonAtomic(path.join(bookDir(user.sub), book.id + ".json"), book);
  return NextResponse.json({ success: true, data: { id: book.id } });
}
