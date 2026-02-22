/**
 * Retrofit labels on all existing artifacts (public + saved):
 * - profiles
 * - reflection styles
 * - initial states
 *
 * Run: npx tsx scripts/retrofit-labels.ts
 *      npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2
 *      npx tsx scripts/retrofit-labels.ts --llm anthropic --model claude-sonnet-4-5-20250929
 *      npx tsx scripts/retrofit-labels.ts --only-missing
 *      npx tsx scripts/retrofit-labels.ts --all
 *      npx tsx scripts/retrofit-labels.ts --styles
 *      npx tsx scripts/retrofit-labels.ts --states
 *      npx tsx scripts/retrofit-labels.ts --profiles --styles --states
 *      npx tsx scripts/retrofit-labels.ts --llm gemini --model gemini-3-pro-preview
 *      npx tsx scripts/retrofit-labels.ts --llm ollama --model llama3.1:8b-instruct-q5_K_M
 *
 * Requires API keys depending on --llm:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_API_KEY
 *
 * Overwrites the `label` field on every selected JSON file by default.
 * Use --only-missing to label only artifacts that currently have no label.
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
  getProfileLabelFromProfileUserPrompt,
  getStyleLabelUserPrompt,
  getStateLabelUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_DIR = path.join(DATA_DIR, "profiles");
const STYLES_DIR = path.join(DATA_DIR, "styles");
const STATES_DIR = path.join(DATA_DIR, "states");
const PUBLIC_PROFILES_DIR = path.join(PROFILES_DIR, "public");
const PUBLIC_STYLES_DIR = path.join(STYLES_DIR, "public");
const PUBLIC_STATES_DIR = path.join(STATES_DIR, "public");

type RetrofitTarget = "profiles" | "styles" | "states";

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

function parseCli(): {
  llmProvider: LlmProvider;
  model: string;
  onlyMissing: boolean;
  targets: Set<RetrofitTarget>;
} {
  if (hasCliFlag("--help") || hasCliFlag("-h")) {
    console.log(
      [
        "Retrofit labels on existing artifacts (public + saved).",
        "",
        "Usage:",
        "  npx tsx scripts/retrofit-labels.ts [--profiles] [--styles] [--states] [--all] [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--only-missing]",
        "",
        "Examples:",
        "  npx tsx scripts/retrofit-labels.ts",
        "  npx tsx scripts/retrofit-labels.ts --only-missing",
        "  npx tsx scripts/retrofit-labels.ts --all",
        "  npx tsx scripts/retrofit-labels.ts --styles",
        "  npx tsx scripts/retrofit-labels.ts --states",
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

  const targets = new Set<RetrofitTarget>();
  const wantsAll = hasCliFlag("--all");
  if (wantsAll || hasCliFlag("--profiles")) targets.add("profiles");
  if (wantsAll || hasCliFlag("--styles")) targets.add("styles");
  if (wantsAll || hasCliFlag("--states")) targets.add("states");
  if (targets.size === 0) {
    // Default: retrofit labels for all artifact types.
    targets.add("profiles");
    targets.add("styles");
    targets.add("states");
  }

  return { llmProvider, model, onlyMissing, targets };
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

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f))
    .filter((fp) => fs.statSync(fp).isFile());
}

function hasNonEmptyLabel(obj: unknown): boolean {
  const label = (obj as { label?: unknown } | null | undefined)?.label;
  return typeof label === "string" && label.trim().length > 0;
}

function getLocale(obj: unknown): OutputLocale {
  const locale = (obj as { locale?: unknown } | null | undefined)?.locale;
  return locale === "fr" ? "fr" : "en";
}

function getDisplayName(target: RetrofitTarget): string {
  return target === "profiles" ? "profile" : target === "styles" ? "style" : "state";
}

async function main() {
  const { llmProvider, model, onlyMissing, targets } = parseCli();

  const allFiles: { target: RetrofitTarget; filePath: string }[] = [];
  if (targets.has("profiles")) {
    collectJsonFiles(PUBLIC_PROFILES_DIR).forEach((fp) =>
      allFiles.push({ target: "profiles", filePath: fp })
    );
    collectJsonFiles(PROFILES_DIR).forEach((fp) =>
      allFiles.push({ target: "profiles", filePath: fp })
    );
  }
  if (targets.has("styles")) {
    collectJsonFiles(PUBLIC_STYLES_DIR).forEach((fp) =>
      allFiles.push({ target: "styles", filePath: fp })
    );
    collectJsonFiles(STYLES_DIR).forEach((fp) =>
      allFiles.push({ target: "styles", filePath: fp })
    );
  }
  if (targets.has("states")) {
    collectJsonFiles(PUBLIC_STATES_DIR).forEach((fp) =>
      allFiles.push({ target: "states", filePath: fp })
    );
    collectJsonFiles(STATES_DIR).forEach((fp) =>
      allFiles.push({ target: "states", filePath: fp })
    );
  }

  if (allFiles.length === 0) {
    console.log("No matching artifact files found.");
    return;
  }

  const targetsList = Array.from(targets.values()).sort().join(", ");
  console.log(
    `Found ${allFiles.length} artifact(s) (${targetsList}). ${onlyMissing ? "Adding missing labels" : "Regenerating labels"} with ${llmProvider}/${model}...\n`,
  );

  let success = 0;
  let fail = 0;
  let skipped = 0;

  for (const { target, filePath } of allFiles) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const obj = JSON.parse(raw);
    const locale: OutputLocale = getLocale(obj);
    const oldLabel =
      typeof (obj as { label?: unknown }).label === "string"
        ? String((obj as { label?: unknown }).label)
        : "(none)";

    if (onlyMissing && hasNonEmptyLabel(obj)) {
      skipped++;
      continue;
    }

    process.stdout.write(
      `  [${getDisplayName(target)}] ${path.basename(filePath)}  ${oldLabel}  ->  `
    );

    try {
      let labelUserPrompt = "";
      if (target === "profiles") {
        const profile = obj as { profile?: string };
        labelUserPrompt = getProfileLabelFromProfileUserPrompt(profile.profile || "", locale);
      } else if (target === "styles") {
        const style = obj as { reflectionStyle?: string };
        labelUserPrompt = getStyleLabelUserPrompt(style.reflectionStyle || "", locale);
      } else {
        const state = obj as { initialState?: string };
        labelUserPrompt = getStateLabelUserPrompt(state.initialState || "", locale);
      }

      const rawLabel = await callLlmText({
        provider: llmProvider,
        model,
        system: PROFILE_LABEL_PROMPT,
        user: labelUserPrompt,
        maxTokens: llmProvider === "gemini" ? undefined : 64,
        temperature: 0.95,
      });
      const label = cleanLabel(rawLabel);

      (obj as { label?: string }).label = label;
      delete (obj as { rawLabel?: unknown }).rawLabel;
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");

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
