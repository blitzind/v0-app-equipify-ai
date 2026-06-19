/** Growth Engine B4 — Video script prompt + model schema (client-safe). */

import { z } from "zod"
import type {
  GrowthVideoScriptGenerationInput,
  GrowthVideoScriptPreviewContext,
} from "@/lib/growth/videos/growth-video-types"

export const growthVideoScriptModelSchema = z.object({
  script: z.string().min(1),
  hook: z.string().min(1),
  talking_points: z.array(z.string()).min(1).max(8),
  cta_copy: z.string().min(1),
  landing_page_title: z.string().min(1),
  landing_page_description: z.string().min(1),
  follow_up_email: z.string().min(1),
  follow_up_sms: z.string().min(1),
  voiceover_notes: z.string().optional(),
  personalization_summary: z.string().optional(),
  recommended_thumbnail_text: z.string().optional(),
  recommended_overlay_text: z.string().optional(),
})

export type GrowthVideoScriptModelOutput = z.infer<typeof growthVideoScriptModelSchema>

export function normalizeGrowthVideoScriptGenerationInput(
  input: Partial<GrowthVideoScriptGenerationInput> | null | undefined,
): GrowthVideoScriptGenerationInput {
  return {
    videoPageId: input?.videoPageId?.trim() || null,
    videoAssetId: input?.videoAssetId?.trim() || null,
    leadId: input?.leadId?.trim() || null,
    companyCandidateId: input?.companyCandidateId?.trim() || null,
    personCandidateId: input?.personCandidateId?.trim() || null,
    personalizationProfileId: input?.personalizationProfileId?.trim() || null,
    sequenceCandidateId: input?.sequenceCandidateId?.trim() || null,
    goal: input?.goal?.trim() || null,
    targetPersona: input?.targetPersona?.trim() || null,
    painPoint: input?.painPoint?.trim() || null,
    offer: input?.offer?.trim() || null,
    cta: input?.cta?.trim() || null,
    tone: input?.tone ?? "professional",
    lengthSeconds: input?.lengthSeconds ?? 45,
  }
}

export function buildGrowthVideoScriptSystemPrompt(): string {
  return [
    "You are a Growth Engine video script assistant for B2B outbound.",
    "Generate personalized short-form video scripts and related copy.",
    "Return strict JSON matching the requested schema.",
    "Never include raw secrets, internal IDs, or automation triggers.",
    "All output requires human review before use.",
    "Do not claim autonomous sending or enrollment.",
  ].join(" ")
}

export function buildGrowthVideoScriptUserPrompt(input: {
  generationInput: GrowthVideoScriptGenerationInput
  previewContext: GrowthVideoScriptPreviewContext
  pageTitle?: string | null
  pageDescription?: string | null
}): string {
  const lines = [
    "Generate a personalized video script package with these fields:",
    "- script (30-60 second spoken script)",
    "- hook (opening line)",
    "- talking_points (3 concise bullets)",
    "- cta_copy",
    "- landing_page_title",
    "- landing_page_description",
    "- follow_up_email",
    "- follow_up_sms",
    "- voiceover_notes",
    "- personalization_summary",
    "- recommended_thumbnail_text",
    "- recommended_overlay_text",
    "",
    "Generation inputs:",
    JSON.stringify(input.generationInput, null, 2),
    "",
    "Resolved merge variables:",
    JSON.stringify(input.previewContext.mergeVariables, null, 2),
    "",
    "Context sources:",
    input.previewContext.sourcesUsed.join(", ") || "preview_form",
  ]

  if (input.pageTitle) lines.push("", `Video page title: ${input.pageTitle}`)
  if (input.pageDescription) lines.push(`Video page description: ${input.pageDescription}`)
  if (input.previewContext.engagementSummary) {
    lines.push("", `Engagement summary: ${input.previewContext.engagementSummary}`)
  }
  if (input.previewContext.overlayHints?.length) {
    lines.push("", `Overlay hints: ${input.previewContext.overlayHints.join(" | ")}`)
  }
  if (input.previewContext.thumbnailHints?.length) {
    lines.push("", `Thumbnail hints: ${input.previewContext.thumbnailHints.join(" | ")}`)
  }

  return lines.join("\n")
}

export function buildGrowthVideoScriptPreviewPrompt(input: {
  generationInput: GrowthVideoScriptGenerationInput
  previewContext: GrowthVideoScriptPreviewContext
}): string {
  return [
    buildGrowthVideoScriptSystemPrompt(),
    "",
    "---",
    "",
    buildGrowthVideoScriptUserPrompt({
      generationInput: input.generationInput,
      previewContext: input.previewContext,
    }),
  ].join("\n")
}

export function mapGrowthVideoScriptModelOutput(
  output: GrowthVideoScriptModelOutput,
  sourcesUsed: string[],
): import("@/lib/growth/videos/growth-video-types").GrowthVideoScriptGeneratedOutput {
  return {
    script: output.script.trim(),
    hook: output.hook.trim(),
    talking_points: output.talking_points.map((point) => point.trim()).filter(Boolean),
    cta_copy: output.cta_copy.trim(),
    landing_page_title: output.landing_page_title.trim(),
    landing_page_description: output.landing_page_description.trim(),
    follow_up_email: output.follow_up_email.trim(),
    follow_up_sms: output.follow_up_sms.trim(),
    voiceover_notes: output.voiceover_notes?.trim() ?? "",
    personalization_summary: output.personalization_summary?.trim() ?? "",
    recommended_thumbnail_text: output.recommended_thumbnail_text?.trim() ?? "",
    recommended_overlay_text: output.recommended_overlay_text?.trim() ?? "",
    sources_used: sourcesUsed,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
