import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireUser } from "@/lib/server/auth";
import { bookDir, readJson, removeFile } from "@/lib/server/store";
import type { Book } from "@/lib/readerTypes";

type Ctx = { params: Promise<{ id: string }> };

function bookPath(sub: string, id: string): string | null {
  if (!/^[a-f0-9]{16}$/.test(id)) return null;
  return path.join(bookDir(sub), id + ".json");
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });
  const { id } = await ctx.params;
  const target = bookPath(user.sub, id);
  const book = target ? await readJson<Book | null>(target, null) : null;
  if (!book) return NextResponse.json({ success: false, error: "找不到這本書" }, { status: 404 });
  return NextResponse.json({ success: true, data: { book } });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });
  const { id } = await ctx.params;
  const target = bookPath(user.sub, id);
  const ok = target ? await removeFile(target) : false;
  if (!ok) return NextResponse.json({ success: false, error: "找不到這本書" }, { status: 404 });
  return NextResponse.json({ success: true });
}
