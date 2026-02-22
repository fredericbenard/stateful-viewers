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
  styleId?: string;
  stateId?: string;
  profileLabel?: string;
  styleLabel?: string;
  stateLabel?: string;
  sessionStartedAt?: string;
  visionProvider?: VisionProvider;
  locale?: OutputLocale;
  /** LLM provider used to generate the profile (may differ from visionProvider). */
  profileLlm?: string;
  /** Human-readable label for the profile-generation LLM. */
  profileLlmModelLabel?: string;
  /** LLM provider used to generate the reflection style (may differ from profileLlm). */
  styleLlm?: string;
  /** Human-readable label for the style-generation LLM. */
  styleLlmModelLabel?: string;
  /** LLM provider used to generate the initial state (may differ from profileLlm). */
  stateLlm?: string;
  /** Human-readable label for the state-generation LLM. */
  stateLlmModelLabel?: string;
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
  const isFr = options?.locale?.toString().toLowerCase().startsWith("fr") ?? false;
  const H = isFr
    ? {
        viewer: "Regardeur",
        profile: "Profil",
        label: "Étiquette",
        reflectionStyle: "Style de réflexion",
        state: "État",
        image: "Image",
        internalStateLabel: "État interne",
        lastInternalState: "Dernier état interne",
        trajectorySummary: "Résumé de la trajectoire",
      }
    : {
        viewer: "Viewer",
        profile: "Profile",
        label: "Label",
        reflectionStyle: "Reflection style",
        state: "State",
        image: "Image",
        internalStateLabel: "Internal state",
        lastInternalState: "Last internal state",
        trajectorySummary: "Trajectory summary",
      };
  const lines: string[] = [];

  lines.push("---");
  lines.push(`exportedAt: ${exportedAt}`);
  lines.push(`galleryId: ${gallery.id}`);
  if (options?.profileId) lines.push(`profileId: ${options.profileId}`);
  if (options?.styleId) lines.push(`styleId: ${options.styleId}`);
  if (options?.stateId) lines.push(`stateId: ${options.stateId}`);
  if (options?.profileLabel) lines.push(`profileLabel: ${JSON.stringify(options.profileLabel)}`);
  if (options?.styleLabel) lines.push(`styleLabel: ${JSON.stringify(options.styleLabel)}`);
  if (options?.stateLabel) lines.push(`stateLabel: ${JSON.stringify(options.stateLabel)}`);
  if (options?.sessionStartedAt)
    lines.push(`sessionStartedAt: ${options.sessionStartedAt}`);
  if (options?.locale) lines.push(`locale: ${options.locale}`);
  if (options?.profileLlm) {
    lines.push(`profileLlm: ${options.profileLlm}`);
    if (options.profileLlmModelLabel) lines.push(`profileLlmModelLabel: ${options.profileLlmModelLabel}`);
  }
  if (options?.styleLlm) {
    lines.push(`styleLlm: ${options.styleLlm}`);
    if (options.styleLlmModelLabel) lines.push(`styleLlmModelLabel: ${options.styleLlmModelLabel}`);
  }
  if (options?.stateLlm) {
    lines.push(`stateLlm: ${options.stateLlm}`);
    if (options.stateLlmModelLabel) lines.push(`stateLlmModelLabel: ${options.stateLlmModelLabel}`);
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

  if (
    profile ||
    reflectionStyle ||
    options?.initialState ||
    options?.profileLabel ||
    options?.styleLabel ||
    options?.stateLabel
  ) {
    lines.push(`## ${H.viewer}`);
    lines.push("");
    if (profile || options?.profileLabel) {
      lines.push(`### ${H.profile}`);
      lines.push("");
      if (options?.profileLabel) {
        lines.push(`**${H.label}:** ${options.profileLabel}`);
        lines.push("");
      }
      if (options?.profileShort) {
        lines.push(`*${options.profileShort}*`);
        lines.push("");
      }
      if (profile) lines.push(profile);
      lines.push("");
    }
    if (reflectionStyle || options?.styleLabel) {
      lines.push(`### ${H.reflectionStyle}`);
      lines.push("");
      if (options?.styleLabel) {
        lines.push(`**${H.label}:** ${options.styleLabel}`);
        lines.push("");
      }
      if (options?.reflectionStyleShort) {
        lines.push(`*${options.reflectionStyleShort}*`);
        lines.push("");
      }
      if (reflectionStyle) lines.push(reflectionStyle);
      lines.push("");
    }
    if (options?.initialState || options?.stateLabel) {
      lines.push(`### ${H.state}`);
      lines.push("");
      if (options?.stateLabel) {
        lines.push(`**${H.label}:** ${options.stateLabel}`);
        lines.push("");
      }
      if (options?.initialStateShort) {
        lines.push(`*${options.initialStateShort}*`);
        lines.push("");
      }
      if (options?.initialState) lines.push(options.initialState);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  reflections.forEach((r) => {
    lines.push(`## ${H.image} ${r.imageIndex + 1}`);
    lines.push("");
    lines.push(`- imageId: ${r.imageId}`);
    lines.push(`- imageUrl: ${r.imageUrl}`);
    if (r.generatedAt) lines.push(`- generatedAt: ${r.generatedAt}`);
    if (r.locale) lines.push(`- locale: ${r.locale}`);
    lines.push("");
    lines.push(r.content);
    if (r.internalState) {
      lines.push("");
      lines.push(`*${H.internalStateLabel}: ${r.internalState}*`);
    }
    lines.push("");
  });

  if (lastInternalState) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${H.lastInternalState}`);
    lines.push("");
    lines.push(lastInternalState);
  }

  if (options?.trajectorySummary) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${H.trajectorySummary}`);
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
    ...(options?.styleId && { styleId: options.styleId }),
    ...(options?.stateId && { stateId: options.stateId }),
    ...(options?.profileLabel && { profileLabel: options.profileLabel }),
    ...(options?.styleLabel && { styleLabel: options.styleLabel }),
    ...(options?.stateLabel && { stateLabel: options.stateLabel }),
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
    ...(options?.styleLlm && { styleLlm: options.styleLlm }),
    ...(options?.styleLlmModelLabel && { styleLlmModelLabel: options.styleLlmModelLabel }),
    ...(options?.stateLlm && { stateLlm: options.stateLlm }),
    ...(options?.stateLlmModelLabel && { stateLlmModelLabel: options.stateLlmModelLabel }),
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
