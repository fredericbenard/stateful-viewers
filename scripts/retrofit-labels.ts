/**
 * Retrofit labels on all existing profiles (public + saved).
 *
 * Run: npx tsx scripts/retrofit-labels.ts
 *
 * Requires OPENAI_API_KEY in .env or environment.
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
const OPENAI_MODEL = "gpt-5.2";

async function callOpenAI(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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
  const files = [
    ...collectProfileFiles(PUBLIC_DIR),
    ...collectProfileFiles(PROFILES_DIR),
  ];

  if (files.length === 0) {
    console.log("No profile files found.");
    return;
  }

  console.log(`Found ${files.length} profile(s). Regenerating labels...\n`);

  let success = 0;
  let fail = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf-8");
    const profile = JSON.parse(raw);
    const locale: OutputLocale = profile.locale || "en";
    const oldLabel = profile.label || "(none)";

    process.stdout.write(`  ${path.basename(filePath)}  ${oldLabel}  ->  `);

    try {
      const rawLabel = await callOpenAI(
        PROFILE_LABEL_PROMPT,
        getProfileLabelUserPrompt(
          profile.profile || "",
          profile.reflectionStyle || "",
          locale,
        ),
      );
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
