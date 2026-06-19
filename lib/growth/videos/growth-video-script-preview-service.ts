/** Growth Engine B4 — Video script preview + deterministic fallback (client-safe). */

import {
  normalizeGrowthVideoScriptGenerationInput,
} from "@/lib/growth/videos/growth-video-script-prompt-service"
import type {
  GrowthVideoScriptAiPayload,
  GrowthVideoScriptGeneratedOutput,
  GrowthVideoScriptGenerationInput,
  GrowthVideoScriptPreviewContext,
} from "@/lib/growth/videos/growth-video-types"

function pickName(mergeVariables: Record<string, string>): string {
  return (
    mergeVariables.first_name?.trim() ||
    mergeVariables["lead.first_name"]?.trim() ||
    "there"
  )
}

function pickCompany(mergeVariables: Record<string, string>): string {
  return (
    mergeVariables.company?.trim() ||
    mergeVariables["lead.company_name"]?.trim() ||
    "your team"
  )
}

export function buildDeterministicGrowthVideoScript(input: {
  generationInput: GrowthVideoScriptGenerationInput
  mergeVariables: Record<string, string>
  sourcesUsed: string[]
}): GrowthVideoScriptGeneratedOutput {
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)
  const firstName = pickName(input.mergeVariables)
  const company = pickCompany(input.mergeVariables)
  const persona = normalized.targetPersona?.trim() || "business owner"
  const painPoint = normalized.painPoint?.trim() || "manual follow-up and missed opportunities"
  const offer = normalized.offer?.trim() || "Equipify"
  const goal = normalized.goal?.trim() || "book a demo"
  const cta = normalized.cta?.trim() || "Schedule a demo"
  const industry = input.mergeVariables.industry?.trim() || input.mergeVariables["lead.industry"]?.trim() || ""

  const hook = `Hi ${firstName}, I put together a quick video for ${company}.`
  const personalization = industry
    ? `I know ${persona}s in ${industry} often deal with ${painPoint}.`
    : `I know ${persona}s often deal with ${painPoint}.`

  const talkingPoints = [
    `${offer} helps teams reduce manual follow-up and respond faster.`,
    `Personalized outreach keeps conversations relevant for ${company}.`,
    `The next step is simple: ${cta.toLowerCase()}.`,
  ]

  const script = [
    hook,
    personalization,
    talkingPoints[0],
    talkingPoints[1],
    `If you're open to it, ${cta.toLowerCase()} — I'd love to show you how ${offer} can help.`,
  ].join(" ")

  return {
    script,
    hook,
    talking_points: talkingPoints,
    cta_copy: cta,
    landing_page_title: `${offer} for ${company}`,
    landing_page_description: `A personalized video explaining how ${offer} helps ${persona}s ${goal}.`,
    follow_up_email: `Hi ${firstName},\n\nI recorded a short video for ${company} about ${painPoint} and how ${offer} can help.\n\n${cta}: reply to this email and I'll send the link.\n\nBest,`,
    follow_up_sms: `Hi ${firstName} — quick video for ${company} on ${painPoint}. ${cta}? Reply YES.`,
    voiceover_notes: "Warm, conversational pace. Pause after hook and before CTA.",
    personalization_summary: `Personalized for ${firstName} at ${company} (${persona}).`,
    recommended_thumbnail_text: `A quick video for ${firstName}`,
    recommended_overlay_text: industry ? `${company} · ${industry}` : company,
    sources_used: [...input.sourcesUsed, "deterministic_fallback"],
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function buildGrowthVideoScriptAiPayload(input: {
  generationInput: GrowthVideoScriptGenerationInput
  previewContext: GrowthVideoScriptPreviewContext
  generatedScript: GrowthVideoScriptGeneratedOutput | null
}): GrowthVideoScriptAiPayload {
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)
  const script = input.generatedScript

  return {
    script_generation_input: normalized,
    resolved_variables: input.previewContext.mergeVariables,
    personalization_context: {
      sources_used: input.previewContext.sourcesUsed,
      engagement_summary: input.previewContext.engagementSummary ?? null,
      overlay_hints: input.previewContext.overlayHints ?? [],
      thumbnail_hints: input.previewContext.thumbnailHints ?? [],
    },
    generated_script: script,
    recommended_thumbnail_text: script?.recommended_thumbnail_text ?? "",
    recommended_overlay_text: script?.recommended_overlay_text ?? "",
    follow_up_assets: {
      email: script?.follow_up_email ?? "",
      sms: script?.follow_up_sms ?? "",
      landing_page_title: script?.landing_page_title ?? "",
      landing_page_description: script?.landing_page_description ?? "",
    },
    sources_used: script?.sources_used ?? input.previewContext.sourcesUsed,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function previewGrowthVideoScriptContext(input: {
  generationInput: GrowthVideoScriptGenerationInput
  mergeVariables: Record<string, string>
  sourcesUsed: string[]
  engagementSummary?: string | null
  overlayHints?: string[]
  thumbnailHints?: string[]
}): {
  previewContext: GrowthVideoScriptPreviewContext
  fallbackScript: GrowthVideoScriptGeneratedOutput
  aiPayload: GrowthVideoScriptAiPayload
} {
  const normalized = normalizeGrowthVideoScriptGenerationInput(input.generationInput)
  const previewContext: GrowthVideoScriptPreviewContext = {
    promptPreview: "",
    mergeVariables: input.mergeVariables,
    sourcesUsed: input.sourcesUsed,
    engagementSummary: input.engagementSummary ?? null,
    overlayHints: input.overlayHints,
    thumbnailHints: input.thumbnailHints,
  }

  const fallbackScript = buildDeterministicGrowthVideoScript({
    generationInput: normalized,
    mergeVariables: input.mergeVariables,
    sourcesUsed: input.sourcesUsed,
  })

  const aiPayload = buildGrowthVideoScriptAiPayload({
    generationInput: normalized,
    previewContext,
    generatedScript: fallbackScript,
  })

  return { previewContext, fallbackScript, aiPayload }
}
