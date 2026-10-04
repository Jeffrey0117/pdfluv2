import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { groqChat } from "@/lib/server/groq";
import { checkRateLimit } from "@/lib/server/rateLimit";

const SYSTEM =
  "你是英文閱讀小老師。使用者在讀英文小說時遇到不懂的單字，給你單字和它所在的句子。" +
  "用繁體中文回答，格式：第一行「這裡的意思：…」（解釋這個字在這句的語境意思，一句話）；" +
  "第二行「整句理解：…」（把整句翻成自然的中文）。不要多餘的開場白。";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "AI 解釋需要登入" }, { status: 401 });
  if (!checkRateLimit("explain:" + user.sub)) {
    return NextResponse.json({ success: false, error: "請求太頻繁" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { word?: unknown; sentence?: unknown } | null;
  const word = typeof body?.word === "string" ? body.word.trim().slice(0, 50) : "";
  const sentence = typeof body?.sentence === "string" ? body.sentence.trim().slice(0, 600) : "";
  if (!word || !sentence) {
    return NextResponse.json({ success: false, error: "缺少 word 或 sentence" }, { status: 400 });
  }

  try {
    const answer = await groqChat(SYSTEM, `單字：${word}\n句子：${sentence}`, 400);
    return NextResponse.json({ success: true, data: { answer } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 解釋失敗";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
