/**
 * Generate v2 public profiles (EN + FR)
 *
 * Run: npx tsx scripts/generate-profiles.ts [count]
 *
 * Requires OPENAI_API_KEY in .env or environment.
 *
 * Generates [count] EN profiles (default 4) with parametric hints, then
 * translates each to FR. Each profile includes: profile, style, initial
 * state, short descriptions for each, and a label.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callLlm, type LlmProvider } from "./lib/llm.ts";
import {
  VIEWER_PROFILE_PROMPT,
  VIEWER_PROFILE_USER_SPEC,
  REFLECTION_STYLE_PROMPT,
  REFLECTION_STYLE_USER_SPEC,
  INITIAL_STATE_PROMPT,
  INITIAL_STATE_USER_SPEC,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
  outputLanguageInstruction,
  generateProfileHint,
  generateStyleHint,
  generateStateHint,
  getProfileLabelUserPrompt,
  getShortProfileUserPrompt,
  getShortStyleUserPrompt,
  getShortStateUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";

const PUBLIC_DIR = path.join(process.cwd(), "data", "profiles", "public");

interface GeneratedProfile {
  id: string;
  generatedAt: string;
  locale: OutputLocale;
  llm: LlmProvider;
  llmModelLabel: string;
  label: string;
  profile: string;
  profileShort: string;
  reflectionStyle: string;
  reflectionStyleShort: string;
  initialState: string;
  initialStateShort: string;
}

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
  count: number;
  llmProvider: LlmProvider;
  model: string;
  temperature: number;
  maxTokens: number;
} {
  if (hasCliFlag("--help") || hasCliFlag("-h")) {
    console.log(
      [
        "Generate v2 public profiles (EN + FR).",
        "",
        "Usage:",
        "  npx tsx scripts/generate-profiles.ts [count] [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--temperature <n>] [--max-tokens <n>]",
        "",
        "Examples:",
        "  npx tsx scripts/generate-profiles.ts 4",
        "  npx tsx scripts/generate-profiles.ts 8 --llm openai --model gpt-5.2",
        "  npx tsx scripts/generate-profiles.ts 6 --llm anthropic --model claude-sonnet-4-5-20250929",
        "  npx tsx scripts/generate-profiles.ts 6 --llm gemini --model gemini-3-pro-preview",
        "  npx tsx scripts/generate-profiles.ts 2 --llm ollama --model llama3.1:8b-instruct-q5_K_M",
        "  npx tsx scripts/generate-profiles.ts 4 --llm gemini --max-tokens 2048",
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
  const count = Math.max(1, parseInt(countArg ?? "4", 10) || 4);

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

function cleanText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  const introPatterns = [
    /^(Here is|Here's) (the |a )?(profile|style|state|label|summary)[:\s]*\n?/i,
    /^(The|This) (profile|style|state|label) (is|:)[:\s]*\n?/i,
  ];
  for (const p of introPatterns) cleaned = cleaned.replace(p, "");
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.trim();
}

function normalizeLabelSentenceCase(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  return words
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
    .join(" ");
}

async function generateOneProfile(
  locale: OutputLocale,
  llmProvider: LlmProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  sourceProfile?: GeneratedProfile
): Promise<GeneratedProfile> {
  const langInstr = outputLanguageInstruction(locale);

  const callText = (
    systemPrompt: string,
    userPrompt: string,
    maxTokensOverride: number = maxTokens
  ): Promise<string> =>
    callLlm({
      provider: llmProvider,
      model,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: maxTokensOverride,
      temperature,
    });

  let profile: string;
  let style: string;
  let state: string;

  if (sourceProfile && locale === "fr") {
    const translateSys = "You are a professional translator. Translate the following text from English to French. Preserve the tone, register, and style. Output only the translation.";
    console.log(`  Translating profile to FR...`);
    profile = await callText(translateSys, sourceProfile.profile);
    console.log(`  Translating style to FR...`);
    style = await callText(translateSys, sourceProfile.reflectionStyle);
    console.log(`  Translating initial state to FR...`);
    state = await callText(translateSys, sourceProfile.initialState);
  } else {
    const profileHint = generateProfileHint();
    const styleHint = generateStyleHint();
    const stateHint = generateStateHint();
    console.log(`  Profile hint: ${profileHint}`);
    console.log(`  Style hint: ${styleHint}`);
    console.log(`  State hint: ${stateHint}`);

    console.log(`  Generating profile...`);
    profile = cleanText(await callText(
      VIEWER_PROFILE_PROMPT,
      `${VIEWER_PROFILE_USER_SPEC}\n\n${langInstr}\n\n${profileHint}`,
    ));

    console.log(`  Generating style...`);
    style = cleanText(await callText(
      REFLECTION_STYLE_PROMPT,
      `${REFLECTION_STYLE_USER_SPEC}\n\n${langInstr}\n\n${styleHint}`,
    ));

    console.log(`  Generating initial state...`);
    state = cleanText(await callText(
      INITIAL_STATE_PROMPT,
      `${INITIAL_STATE_USER_SPEC}\n\n${langInstr}\n\n${stateHint}`,
    ));
  }

  console.log(`  Generating label...`);
  const labelRaw = await callText(
    PROFILE_LABEL_PROMPT,
    getProfileLabelUserPrompt(profile, style, locale),
    llmProvider === "gemini" ? maxTokens : 64
  );
  const label = normalizeLabelSentenceCase(cleanText(labelRaw));

  console.log(`  Generating short descriptions...`);
  const [profileShortRaw, styleShortRaw, stateShortRaw] = await Promise.all([
    callText(
      SHORT_DESCRIPTION_PROMPT,
      getShortProfileUserPrompt(profile, locale),
      llmProvider === "gemini" ? maxTokens : 256
    ),
    callText(
      SHORT_DESCRIPTION_PROMPT,
      getShortStyleUserPrompt(style, locale),
      llmProvider === "gemini" ? maxTokens : 256
    ),
    callText(
      SHORT_DESCRIPTION_PROMPT,
      getShortStateUserPrompt(state, locale),
      llmProvider === "gemini" ? maxTokens : 128
    ),
  ]);

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    locale,
    llm: llmProvider,
    llmModelLabel: model,
    label,
    profile,
    profileShort: cleanText(profileShortRaw),
    reflectionStyle: style,
    reflectionStyleShort: cleanText(styleShortRaw),
    initialState: state,
    initialStateShort: cleanText(stateShortRaw),
  };
}

async function main() {
  const { count, llmProvider, model, temperature, maxTokens } = parseCli();
  console.log(
    `Generating ${count} v2 public profiles (EN + FR) with ${llmProvider}/${model} (temperature=${temperature}, maxTokens=${maxTokens})...\n`,
  );

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const enProfiles: GeneratedProfile[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n=== EN Profile ${i + 1}/${count} ===`);
    const profile = await generateOneProfile("en", llmProvider, model, temperature, maxTokens);
    enProfiles.push(profile);

    const filePath = path.join(PUBLIC_DIR, `${profile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${profile.label}`);
  }

  for (let i = 0; i < count; i++) {
    console.log(`\n=== FR Profile ${i + 1}/${count} (translating from EN) ===`);
    const frProfile = await generateOneProfile(
      "fr",
      llmProvider,
      model,
      temperature,
      maxTokens,
      enProfiles[i]
    );

    const filePath = path.join(PUBLIC_DIR, `${frProfile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(frProfile, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${frProfile.label}`);
  }

  console.log(`\n\nDone! Generated ${count} EN + ${count} FR profiles in data/profiles/public/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
