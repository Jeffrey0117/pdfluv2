import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { newId, readJson, vocabPath, writeJsonAtomic } from "@/lib/server/store";
import type { VocabItem } from "@/lib/readerTypes";

const MAX_ITEMS = 1000;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });
  const items = await readJson<VocabItem[]>(vocabPath(user.sub), []);
  return NextResponse.json({ success: true, data: { items: items.slice().reverse() } });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const word = typeof body?.word === "string" ? body.word.trim().toLowerCase().slice(0, 50) : "";
  if (!word) return NextResponse.json({ success: false, error: "缺少單字" }, { status: 400 });

  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const items = await readJson<VocabItem[]>(vocabPath(user.sub), []);
  if (items.some((x) => x.word === word && x.sentence === clean(body?.sentence, 600))) {
    return NextResponse.json({ success: true, data: { already: true } });
  }
  if (items.length >= MAX_ITEMS) {
    return NextResponse.json({ success: false, error: "生詞本已滿" }, { status: 400 });
  }

  const item: VocabItem = {
    id: newId(),
    word,
    phonetic: clean(body?.phonetic, 100),
    meaning: clean(body?.meaning, 300),
    sentence: clean(body?.sentence, 600),
    bookTitle: clean(body?.bookTitle, 200),
    createdAt: new Date().toISOString(),
  };
  await writeJsonAtomic(vocabPath(user.sub), [...items, item]);
  return NextResponse.json({ success: true, data: { item } });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const items = await readJson<VocabItem[]>(vocabPath(user.sub), []);
  if (!items.some((x) => x.id === id)) {
    return NextResponse.json({ success: false, error: "找不到這個生詞" }, { status: 404 });
  }
  await writeJsonAtomic(
    vocabPath(user.sub),
    items.filter((x) => x.id !== id)
  );
  return NextResponse.json({ success: true });
}
