/**
 * Retrofit labels on all existing profiles (public + saved).
 *
 * Run: npx tsx scripts/retrofit-labels.ts
 *      npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2
 *      npx tsx scripts/retrofit-labels.ts --llm anthropic --model claude-sonnet-4-5-20250929
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
import { callLlm as callLlmText } from "./lib/llm.ts";
import type { LlmProvider } from "./lib/llm.ts";
import {
  PROFILE_LABEL_PROMPT,
  getProfileLabelUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";

const PROFILES_DIR = path.join(process.cwd(), "data", "profiles");
const PUBLIC_DIR = path.join(PROFILES_DIR, "public");

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
        "  npx tsx scripts/retrofit-labels.ts [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--only-missing]",
        "",
        "Examples:",
        "  npx tsx scripts/retrofit-labels.ts",
        "  npx tsx scripts/retrofit-labels.ts --only-missing",
        "  npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2",
        "  npx tsx scripts/retrofit-labels.ts --llm anthropic --model claude-sonnet-4-5-20250929",
        "  npx tsx scripts/retrofit-labels.ts --llm gemini --model gemini-3-pro-preview",
        "  npx tsx scripts/retrofit-labels.ts --llm ollama --model llama3.1:8b-instruct-q5_K_M",
        "",
        "Env vars:",
        "  OPENAI_API_KEY      (for --llm openai)",
        "  ANTHROPIC_API_KEY   (for --llm anthropic)",
        "  GOOGLE_API_KEY      (for --llm gemini)",
        "  OLLAMA_BASE_URL     (optional, for --llm ollama; default http://localhost:11434)",
      ].join("\n"),
    );
    process.exit(0);
  }

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
        ? "claude-sonnet-4-5-20250929"
        : llmProvider === "gemini"
          ? "gemini-3-pro-preview"
          : "llama3.1:8b-instruct-q5_K_M";
  const model = getCliFlagValue("--model") ?? defaultModel;
  const onlyMissing = hasCliFlag("--only-missing");

  return { llmProvider, model, onlyMissing };
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
      const rawLabel = await callLlmText({
        provider: llmProvider,
        model,
        system: PROFILE_LABEL_PROMPT,
        user: getProfileLabelUserPrompt(
          profile.profile || "",
          profile.reflectionStyle || "",
          locale,
        ),
        maxTokens: llmProvider === "gemini" ? undefined : 64,
        temperature: 0.95,
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
