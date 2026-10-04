// AI chat completion（語境解釋、講義筆記用）— OpenAI 相容介面，env 可切供應商
// AI_BASE_URL + AI_API_KEY + AI_MODEL；預設 OpenAI，GROQ_API_KEY 存在時自動走 Groq
const hasGroq = !!process.env.GROQ_API_KEY;
const BASE_URL =
  process.env.AI_BASE_URL || (hasGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
const MODEL = process.env.AI_MODEL || (hasGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");

export async function groqChat(system: string, user: string, maxTokens = 500): Promise<string> {
  const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI 服務未設定（缺 AI_API_KEY）");
  const res = await fetch(BASE_URL + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 服務回應 ${res.status}${detail ? ": " + detail.slice(0, 200) : ""}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 回應為空");
  return content.trim();
}
