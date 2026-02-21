export type LlmProvider = "openai" | "anthropic" | "gemini" | "ollama";

export type CallLlmArgs = {
  provider: LlmProvider;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: timeoutMsFromInit, ...rest } = init ?? {};
  void timeoutMsFromInit;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...rest, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidate = (data.candidates as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined;
  if (!candidate) return "";

  const content = candidate.content as { parts?: unknown[] } | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";

  const textParts: string[] = [];
  for (const part of parts) {
    const p = part as { text?: string; thought?: boolean };
    const text = p.text;
    if (!text || typeof text !== "string") continue;
    if (p.thought) continue;
    textParts.push(text);
  }

  const result = textParts.join("").trim();
  if (result) return result;

  return parts
    .map((p) => (p as Record<string, unknown>).text as string | undefined)
    .filter((t): t is string => typeof t === "string")
    .join("")
    .trim();
}

async function callOpenAI(args: CallLlmArgs): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required (for --llm openai)");

  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      ...(args.maxTokens != null ? { max_completion_tokens: args.maxTokens } : {}),
      ...(args.temperature != null ? { temperature: args.temperature } : {}),
    }),
    timeoutMs: args.timeoutMs,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const choices = data.choices as unknown[] | undefined;
  const first = choices?.[0] as Record<string, unknown> | undefined;
  const msg = first?.message as Record<string, unknown> | undefined;
  return String(msg?.content ?? "").trim();
}

async function callAnthropic(args: CallLlmArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("ANTHROPIC_API_KEY required (for --llm anthropic)");

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      max_tokens: args.maxTokens ?? 1024,
      ...(args.temperature != null ? { temperature: args.temperature } : {}),
    }),
    timeoutMs: args.timeoutMs,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const content = data.content as { type: string; text?: string }[] | undefined;
  const textBlock = Array.isArray(content)
    ? content.find((b) => b.type === "text" && typeof b.text === "string")
    : undefined;
  return String(textBlock?.text ?? "").trim();
}

async function callGemini(args: CallLlmArgs): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY required (for --llm gemini)");

  const maxOutputTokens = args.maxTokens ?? 4096;
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ parts: [{ text: args.user }] }],
        generationConfig: {
          ...(args.temperature != null ? { temperature: args.temperature } : {}),
          maxOutputTokens,
          thinkingConfig: {
            thinkingBudget: 2048,
          },
        },
      }),
      timeoutMs: args.timeoutMs,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return extractTextFromGeminiResponse(data).trim();
}

async function callOllama(args: CallLlmArgs): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const res = await fetchWithTimeout(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      stream: false,
      ...(args.temperature != null || args.maxTokens != null
        ? {
            options: {
              ...(args.temperature != null ? { temperature: args.temperature } : {}),
              ...(args.maxTokens != null ? { num_predict: args.maxTokens } : {}),
            },
          }
        : {}),
    }),
    timeoutMs: args.timeoutMs,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const message = data.message as Record<string, unknown> | undefined;
  return String(message?.content ?? "").trim();
}

export async function callLlm(args: CallLlmArgs): Promise<string> {
  if (args.provider === "anthropic") return callAnthropic(args);
  if (args.provider === "gemini") return callGemini(args);
  if (args.provider === "ollama") return callOllama(args);
  return callOpenAI(args);
}

