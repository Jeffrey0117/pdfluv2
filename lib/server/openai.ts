import type { TargetLang } from "@/lib/types";

const LANG_NAMES: Record<TargetLang, string> = {
  "zh-TW": "繁體中文（台灣用語）",
  "zh-CN": "简体中文",
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export interface OpenAiOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export async function translateWithOpenAi(
  text: string,
  targetLang: TargetLang,
  options: OpenAiOptions
): Promise<string> {
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `你是專業翻譯。把使用者提供的文字翻譯成${LANG_NAMES[targetLang]}。保留原本的段落結構與換行，術語準確自然。只輸出翻譯結果，不要任何說明或前綴。`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = (await res.json().catch(() => null)) as ChatCompletionResponse | null;

  if (!res.ok) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`AI 翻譯失敗：${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("AI 回傳內容為空");
  }

  return content.trim();
}
