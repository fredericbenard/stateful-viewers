import type { LlmProvider } from "./llm.ts";

export const TRANSLATE_EN_TO_FR_SYSTEM_PROMPT =
  "You are a professional translator. Translate the following text from English to French. Preserve the tone, register, and style. Output only the translation.";

export function getCliFlagValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === flag) return argv[i + 1];
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return undefined;
}

export function hasCliFlag(flag: string): boolean {
  const argv = process.argv.slice(2);
  return argv.includes(flag) || argv.some((a) => a.startsWith(`${flag}=`));
}

export function cleanText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  const introPatterns = [
    /^(Here is|Here's) (the |a )?(profile|style|state|label|summary)[:\s]*\n?/i,
    /^(The|This) (profile|style|state|label) (is|:)[:\s]*\n?/i,
    /^(Label|Name)[:\s]*\n?/i,
  ];
  for (const p of introPatterns) cleaned = cleaned.replace(p, "");
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.trim();
}

export function normalizeLabelSentenceCase(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  return words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.toLowerCase()
    )
    .join(" ");
}

export function parseGenerateCli(opts: {
  helpHeader: string;
  usageLine: string;
  examples: string[];
  defaultCount?: number;
}): {
  count: number;
  llmProvider: LlmProvider;
  model: string;
  temperature: number;
  maxTokens: number;
} {
  const defaultCount = Math.max(1, Math.floor(opts.defaultCount ?? 1));

  if (hasCliFlag("--help") || hasCliFlag("-h")) {
    console.log(
      [
        opts.helpHeader,
        "",
        "Usage:",
        `  ${opts.usageLine}`,
        "",
        "Examples:",
        ...opts.examples.map((e) => `  ${e}`),
        "",
        "Env vars (depending on --llm):",
        "  OPENAI_API_KEY",
        "  ANTHROPIC_API_KEY",
        "  GOOGLE_API_KEY",
        "  OLLAMA_BASE_URL (optional; default http://localhost:11434)",
      ].join("\n")
    );
    process.exit(0);
  }

  const argv = process.argv.slice(2);
  const countArg = argv.find((a) => /^\d+$/.test(a));
  const count = Math.max(1, parseInt(countArg ?? String(defaultCount), 10) || defaultCount);

  const llmRaw = (getCliFlagValue("--llm") ?? "openai").toLowerCase();
  const llmProvider: LlmProvider =
    llmRaw === "anthropic"
      ? "anthropic"
      : llmRaw === "gemini"
        ? "gemini"
        : llmRaw === "ollama"
          ? "ollama"
          : "openai";

  const defaultModel =
    llmProvider === "openai"
      ? "gpt-5.2"
      : llmProvider === "anthropic"
        ? "claude-sonnet-4-6"
        : llmProvider === "gemini"
          ? "gemini-3-pro-preview"
          : "llama3.1:8b-instruct-q5_K_M";
  const model = getCliFlagValue("--model") ?? defaultModel;

  const temperatureRaw = getCliFlagValue("--temperature");
  const temperature = Number.isFinite(Number(temperatureRaw))
    ? Math.max(0, Math.min(2, Number(temperatureRaw)))
    : 0.95;

  const maxTokensRaw = getCliFlagValue("--max-tokens");
  const maxTokens = Number.isFinite(Number(maxTokensRaw))
    ? Math.max(64, Math.min(8192, Math.floor(Number(maxTokensRaw))))
    : llmProvider === "gemini"
      ? 4096
      : 1024;

  return { count, llmProvider, model, temperature, maxTokens };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

