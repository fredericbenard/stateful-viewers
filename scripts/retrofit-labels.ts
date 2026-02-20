/**
 * Retrofit labels on all existing profiles (public + saved).
 *
 * Run: npx tsx scripts/retrofit-labels.ts
 *      npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2
 *      npx tsx scripts/retrofit-labels.ts --llm anthropic --model claude-3-5-sonnet-20241022
 *
 * Requires OPENAI_API_KEY or ANTHROPIC_API_KEY (depending on --llm) in .env or environment.
 * Overwrites the `label` field on every profile JSON file.
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

type LlmProvider = "openai" | "anthropic";

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

function parseCli(): { llmProvider: LlmProvider; model: string } {
  if (hasCliFlag("--help") || hasCliFlag("-h")) {
    console.log(
      [
        "Retrofit labels on all existing profiles (public + saved).",
        "",
        "Usage:",
        "  npx tsx scripts/retrofit-labels.ts [--llm <openai|anthropic|claude>] [--model <model>]",
        "",
        "Examples:",
        "  npx tsx scripts/retrofit-labels.ts",
        "  npx tsx scripts/retrofit-labels.ts --llm openai --model gpt-5.2",
        "  npx tsx scripts/retrofit-labels.ts --llm claude --model claude-3-5-sonnet-20241022",
        "",
        "Env vars:",
        "  OPENAI_API_KEY      (for --llm openai)",
        "  ANTHROPIC_API_KEY   (for --llm anthropic/claude)",
      ].join("\n"),
    );
    process.exit(0);
  }

  const llmRaw = (getCliFlagValue("--llm") ?? "openai").toLowerCase();
  const llmProvider: LlmProvider =
    llmRaw === "anthropic" || llmRaw === "claude" ? "anthropic" : "openai";

  const defaultModel =
    llmProvider === "openai" ? "gpt-5.2" : "claude-3-5-sonnet-20241022";
  const model = getCliFlagValue("--model") ?? defaultModel;

  return { llmProvider, model };
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

async function callLlm(args: {
  llmProvider: LlmProvider;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  if (args.llmProvider === "anthropic") {
    return callAnthropic(args.model, args.system, args.user);
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
  const { llmProvider, model } = parseCli();
  const files = [
    ...collectProfileFiles(PUBLIC_DIR),
    ...collectProfileFiles(PROFILES_DIR),
  ];

  if (files.length === 0) {
    console.log("No profile files found.");
    return;
  }

  console.log(
    `Found ${files.length} profile(s). Regenerating labels with ${llmProvider}/${model}...\n`,
  );

  let success = 0;
  let fail = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const profile = JSON.parse(raw);
    const locale: OutputLocale = profile.locale || "en";
    const oldLabel = profile.label || "(none)";

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

  console.log(`\nDone. ${success} updated, ${fail} failed.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
