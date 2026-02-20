/**
 * Retrofit labels on all existing profiles (public + saved).
 *
 * Run: npx tsx scripts/retrofit-labels.ts
 *      npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2
 *      npx tsx scripts/retrofit-labels.ts --llm anthropic --model claude-3-5-sonnet-20241022
 *      npx tsx scripts/retrofit-labels.ts --only-missing
 *      npx tsx scripts/retrofit-labels.ts --llm gemini --model gemini-3-pro-preview
 *      npx tsx scripts/retrofit-labels.ts --llm ollama --model llama3.1:8b-instruct-q5_K_M
 *
 * Requires API keys depending on --llm:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_API_KEY
 *
 * Overwrites the `label` field on every profile JSON file by default.
 * Use --only-missing to label only profiles that currently have no label.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import {
  PROFILE_LABEL_PROMPT,
  getProfileLabelUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";

const PROFILES_DIR = path.join(process.cwd(), "data", "profiles");
const PUBLIC_DIR = path.join(PROFILES_DIR, "public");

type LlmProvider = "openai" | "anthropic" | "gemini" | "ollama";

function getCliFlagValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === flag) return argv[i + 1];
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return undefined;
}

function hasCliFlag(flag: string): boolean {
  const argv = process.argv.slice(2);
  return argv.includes(flag) || argv.some((a) => a.startsWith(`${flag}=`));
}

function parseCli(): { llmProvider: LlmProvider; model: string; onlyMissing: boolean } {
  if (hasCliFlag("--help") || hasCliFlag("-h")) {
    console.log(
      [
        "Retrofit labels on all existing profiles (public + saved).",
        "",
        "Usage:",
        "  npx tsx scripts/retrofit-labels.ts [--llm <openai|anthropic|claude|gemini|ollama>] [--model <model>] [--only-missing]",
        "",
        "Examples:",
        "  npx tsx scripts/retrofit-labels.ts",
        "  npx tsx scripts/retrofit-labels.ts --only-missing",
        "  npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2",
        "  npx tsx scripts/retrofit-labels.ts --llm claude --model claude-3-5-sonnet-20241022",
        "  npx tsx scripts/retrofit-labels.ts --llm gemini --model gemini-3-pro-preview",
        "  npx tsx scripts/retrofit-labels.ts --llm ollama --model llama3.1:8b-instruct-q5_K_M",
        "",
        "Env vars:",
        "  OPENAI_API_KEY      (for --llm openai)",
        "  ANTHROPIC_API_KEY   (for --llm anthropic/claude)",
        "  GOOGLE_API_KEY      (for --llm gemini)",
        "  OLLAMA_BASE_URL     (optional, for --llm ollama; default http://localhost:11434)",
      ].join("\n"),
    );
    process.exit(0);
  }

  const llmRaw = (getCliFlagValue("--llm") ?? "openai").toLowerCase();
  const llmProvider: LlmProvider =
    llmRaw === "anthropic" || llmRaw === "claude"
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
        ? "claude-3-5-sonnet-20241022"
        : llmProvider === "gemini"
          ? "gemini-3-pro-preview"
          : "llama3.1:8b-instruct-q5_K_M";
  const model = getCliFlagValue("--model") ?? defaultModel;
  const onlyMissing = hasCliFlag("--only-missing");

  return { llmProvider, model, onlyMissing };
}

async function callOpenAI(
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required (for --llm openai)");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: 64,
      temperature: 0.95,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("ANTHROPIC_API_KEY required (for --llm anthropic/claude)");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 64,
      temperature: 0.95,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const first = data.content?.[0];
  if (first?.type === "text") return String(first.text ?? "").trim();
  return String(first?.text ?? "").trim();
}

/**
 * Extract text from Gemini API response.
 * Gemini may return multiple parts (including thinking blocks).
 * We want the actual answer (non-thought parts).
 */
function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidate = data.candidates?.[0] as Record<string, unknown> | undefined;
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

async function callGemini(
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY required (for --llm gemini)");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.95, maxOutputTokens: 128 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return extractTextFromGeminiResponse(data).trim();
}

async function callOllama(
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
      options: { temperature: 0.95 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return String(data.message?.content ?? "").trim();
}

async function callLlm(args: {
  llmProvider: LlmProvider;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  if (args.llmProvider === "anthropic") {
    return callAnthropic(args.model, args.system, args.user);
  }
  if (args.llmProvider === "gemini") {
    return callGemini(args.model, args.system, args.user);
  }
  if (args.llmProvider === "ollama") {
    return callOllama(args.model, args.system, args.user);
  }
  return callOpenAI(args.model, args.system, args.user);
}

function cleanLabel(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  const introPatterns = [
    /^(Here is|Here's) (the |a )?(label|name)[:\s]*\n?/i,
    /^(The|This) (label|name) (is|:)[:\s]*\n?/i,
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

function collectProfileFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f))
    .filter((fp) => fs.statSync(fp).isFile());
}

async function main() {
  const { llmProvider, model, onlyMissing } = parseCli();
  const files = [
    ...collectProfileFiles(PUBLIC_DIR),
    ...collectProfileFiles(PROFILES_DIR),
  ];

  if (files.length === 0) {
    console.log("No profile files found.");
    return;
  }

  console.log(
    `Found ${files.length} profile(s). ${onlyMissing ? "Adding missing labels" : "Regenerating labels"} with ${llmProvider}/${model}...\n`,
  );

  let success = 0;
  let fail = 0;
  let skipped = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const profile = JSON.parse(raw);
    const locale: OutputLocale = profile.locale || "en";
    const oldLabel = profile.label || "(none)";

    const hasLabel =
      typeof profile.label === "string" && profile.label.trim().length > 0;
    if (onlyMissing && hasLabel) {
      skipped++;
      continue;
    }

    process.stdout.write(`  ${path.basename(filePath)}  ${oldLabel}  ->  `);

    try {
      const rawLabel = await callLlm({
        llmProvider,
        model,
        system: PROFILE_LABEL_PROMPT,
        user: getProfileLabelUserPrompt(
          profile.profile || "",
          profile.reflectionStyle || "",
          locale,
        ),
      });
      const label = cleanLabel(rawLabel);

      profile.label = label;
      delete profile.rawLabel;
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");

      console.log(label);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED (${msg})`);
      fail++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${success} updated, ${fail} failed, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
