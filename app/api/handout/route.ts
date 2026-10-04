import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { requireUser } from "@/lib/server/auth";
import { groqChat } from "@/lib/server/groq";
import { readJson, vocabPath } from "@/lib/server/store";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { HandoutPdf, type HandoutEntry } from "@/lib/server/handoutDocument";
import type { VocabItem } from "@/lib/readerTypes";

const MAX_WORDS = 30;

const NOTE_SYSTEM =
  "你是英文講義編輯。給你一批學生從小說收藏的生詞（含出處句子），為每個詞寫一則 1-2 句的繁體中文用法筆記：" +
  "常見用法、搭配詞或易混淆點，實用為主。只回傳 JSON 陣列，格式 [{\"word\":\"...\",\"note\":\"...\"}]，不要其他文字。";

async function buildNotes(items: VocabItem[]): Promise<Map<string, string>> {
  const list = items.map((x) => `${x.word}：${x.sentence || "(無句子)"}`).join("\n");
  const notes = new Map<string, string>();
  try {
    const raw = await groqChat(NOTE_SYSTEM, list, 2000);
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(jsonText) as { word?: string; note?: string }[];
    for (const row of parsed) {
      if (row.word && row.note) notes.set(String(row.word).toLowerCase(), String(row.note).slice(0, 300));
    }
  } catch {
    // AI 失敗就出無筆記版講義，不擋流程
  }
  return notes;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ success: false, error: "請先登入" }, { status: 401 });
  if (!checkRateLimit("handout:" + user.sub)) {
    return NextResponse.json({ success: false, error: "請求太頻繁" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const wantIds = Array.isArray(body?.ids) ? new Set(body.ids.map(String)) : null;

  const all = await readJson<VocabItem[]>(vocabPath(user.sub), []);
  const picked = (wantIds ? all.filter((x) => wantIds.has(x.id)) : all).slice(-MAX_WORDS);
  if (picked.length === 0) {
    return NextResponse.json({ success: false, error: "生詞本是空的，先去讀書收藏幾個字吧" }, { status: 400 });
  }

  const notes = await buildNotes(picked);
  const entries: HandoutEntry[] = picked.map((x) => ({ ...x, note: notes.get(x.word) || "" }));

  const doc = createElement(HandoutPdf, { ownerName: user.name, entries }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="vocab-handout.pdf"',
    },
  });
}
