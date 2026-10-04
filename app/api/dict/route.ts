import { NextRequest, NextResponse } from "next/server";
import { lookup } from "@/lib/server/dict";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkRateLimit("dict:" + ip)) {
    return NextResponse.json({ success: false, error: "請求太頻繁" }, { status: 429 });
  }
  const w = req.nextUrl.searchParams.get("w") || "";
  if (!w || w.length > 50) {
    return NextResponse.json({ success: false, error: "缺少查詢字" }, { status: 400 });
  }
  const entry = await lookup(w);
  if (!entry) return NextResponse.json({ success: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: entry });
}
