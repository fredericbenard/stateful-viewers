/**
 * Export session data as markdown or JSON.
 *
 * LLM provenance uses consistent field names across both formats:
 *   profileLlm / profileLlmModelLabel       -- LLM that generated the profile
 *   reflectionLlm / reflectionLlmModelLabel  -- text LLM used for reflections
 *   reflectionVlm / reflectionVlmModelLabel  -- vision model used for reflections
 */

import type { Gallery } from "../data/galleries";
import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { getModelLabels } from "./saveReflectionSession";

export interface ExportReflection {
  imageIndex: number;
  imageId: string;
  imageUrl: string;
  content: string;
  internalState?: string;
  generatedAt?: string;
  locale?: OutputLocale;
}

export interface ExportOptions {
  profileId?: string;
  profileLabel?: string;
  sessionStartedAt?: string;
  visionProvider?: VisionProvider;
  locale?: OutputLocale;
  /** LLM provider used to generate the profile (may differ from visionProvider). */
  profileLlm?: string;
  /** Human-readable label for the profile-generation LLM. */
  profileLlmModelLabel?: string;
  trajectorySummary?: string;
  trajectorySummaryLocale?: OutputLocale;
  trajectorySummaryGeneratedAt?: string;
  initialState?: string;
  profileShort?: string;
  reflectionStyleShort?: string;
  initialStateShort?: string;
}

export function exportAsMarkdown(
  gallery: Gallery,
  reflections: ExportReflection[],
  lastInternalState: string,
  profile?: string,
  reflectionStyle?: string,
  options?: ExportOptions
): string {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [];

  lines.push("---");
  lines.push(`exportedAt: ${exportedAt}`);
  lines.push(`galleryId: ${gallery.id}`);
  if (options?.profileId) lines.push(`profileId: ${options.profileId}`);
  if (options?.profileLabel) lines.push(`profileLabel: ${JSON.stringify(options.profileLabel)}`);
  if (options?.sessionStartedAt)
    lines.push(`sessionStartedAt: ${options.sessionStartedAt}`);
  if (options?.locale) lines.push(`locale: ${options.locale}`);
  if (options?.profileLlm) {
    lines.push(`profileLlm: ${options.profileLlm}`);
    if (options.profileLlmModelLabel) lines.push(`profileLlmModelLabel: ${options.profileLlmModelLabel}`);
  }
  if (options?.visionProvider) {
    const labels = getModelLabels(options.visionProvider);
    lines.push(`reflectionLlm: ${options.visionProvider}`);
    lines.push(`reflectionLlmModelLabel: ${labels.llm}`);
    lines.push(`reflectionVlm: ${options.visionProvider}`);
    lines.push(`reflectionVlmModelLabel: ${labels.vlm}`);
  }
  lines.push("---");
  lines.push("");

  lines.push(`# ${gallery.name} — ${gallery.era}`);
  lines.push("");
  lines.push(gallery.description);
  lines.push("");

  if (profile || reflectionStyle || options?.initialState) {
    lines.push("## Viewer");
    lines.push("");
    if (options?.profileLabel) {
      lines.push("### Label");
      lines.push("");
      lines.push(options.profileLabel);
      lines.push("");
    }
    if (profile) {
      lines.push("### Profile");
      lines.push("");
      if (options?.profileShort) {
        lines.push(`*${options.profileShort}*`);
        lines.push("");
      }
      lines.push(profile);
      lines.push("");
    }
    if (reflectionStyle) {
      lines.push("### Reflection style");
      lines.push("");
      if (options?.reflectionStyleShort) {
        lines.push(`*${options.reflectionStyleShort}*`);
        lines.push("");
      }
      lines.push(reflectionStyle);
      lines.push("");
    }
    if (options?.initialState) {
      lines.push("### Initial state");
      lines.push("");
      if (options?.initialStateShort) {
        lines.push(`*${options.initialStateShort}*`);
        lines.push("");
      }
      lines.push(options.initialState);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  reflections.forEach((r) => {
    lines.push(`## Image ${r.imageIndex + 1}`);
    lines.push("");
    lines.push(`- imageId: ${r.imageId}`);
    lines.push(`- imageUrl: ${r.imageUrl}`);
    if (r.generatedAt) lines.push(`- generatedAt: ${r.generatedAt}`);
    if (r.locale) lines.push(`- locale: ${r.locale}`);
    lines.push("");
    lines.push(r.content);
    if (r.internalState) {
      lines.push("");
      lines.push(`*Internal state: ${r.internalState}*`);
    }
    lines.push("");
  });

  if (lastInternalState) {
    lines.push("---");
    lines.push("");
    lines.push("## Last internal state");
    lines.push("");
    lines.push(lastInternalState);
  }

  if (options?.trajectorySummary) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Trajectory summary");
    lines.push("");
    if (options.trajectorySummaryGeneratedAt) {
      lines.push(`- generatedAt: ${options.trajectorySummaryGeneratedAt}`);
    }
    if (options.trajectorySummaryLocale) {
      lines.push(`- locale: ${options.trajectorySummaryLocale}`);
    }
    if (options.trajectorySummaryGeneratedAt || options.trajectorySummaryLocale) {
      lines.push("");
    }
    lines.push(options.trajectorySummary);
  }

  return lines.join("\n");
}

export function exportAsJson(
  gallery: Gallery,
  reflections: ExportReflection[],
  lastInternalState: string,
  profile?: string,
  reflectionStyle?: string,
  options?: ExportOptions
): string {
  const lastUpdatedAt = new Date().toISOString();
  const provider = options?.visionProvider ?? "openai";
  const labels = getModelLabels(provider);
  const sessionStartedAt = options?.sessionStartedAt ?? new Date().toISOString();
  const payload: Record<string, unknown> = {
    profileId: options?.profileId ?? "anonymous",
    ...(options?.profileLabel && { profileLabel: options.profileLabel }),
    galleryId: gallery.id,
    sessionStartedAt,
    lastUpdatedAt,
    ...(options?.locale && { locale: options.locale }),
    gallery: {
      id: gallery.id,
      name: gallery.name,
      era: gallery.era,
      description: gallery.description,
    },
    ...(options?.profileLlm && { profileLlm: options.profileLlm }),
    ...(options?.profileLlmModelLabel && { profileLlmModelLabel: options.profileLlmModelLabel }),
    profile: profile ?? "",
    ...(options?.profileShort && { profileShort: options.profileShort }),
    reflectionStyle: reflectionStyle ?? "",
    ...(options?.reflectionStyleShort && { reflectionStyleShort: options.reflectionStyleShort }),
    ...(options?.initialState && { initialState: options.initialState }),
    ...(options?.initialStateShort && { initialStateShort: options.initialStateShort }),
    reflections: reflections.map((r) => ({
      imageIndex: r.imageIndex,
      imageId: r.imageId,
      imageUrl: r.imageUrl,
      content: r.content,
      ...(r.internalState && { internalState: r.internalState }),
      ...(r.generatedAt && { generatedAt: r.generatedAt }),
      ...(r.locale && { locale: r.locale }),
    })),
    lastInternalState,
    reflectionLlm: provider,
    reflectionLlmModelLabel: labels.llm,
    reflectionVlm: provider,
    reflectionVlmModelLabel: labels.vlm,
    ...(options?.trajectorySummary && { trajectorySummary: options.trajectorySummary }),
    ...(options?.trajectorySummaryLocale && { trajectorySummaryLocale: options.trajectorySummaryLocale }),
    ...(options?.trajectorySummaryGeneratedAt && { trajectorySummaryGeneratedAt: options.trajectorySummaryGeneratedAt }),
  };

  return JSON.stringify(payload, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType?: string): void {
  const blob = new Blob([content], { type: mimeType ?? "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
