/** Growth Engine S2-G — client-safe voice generation helpers (no provider execution). */

import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type {
  GrowthMediaVoiceGenerationScriptPreview,
  GrowthMediaVoicePersonalizationContext,
} from "@/lib/growth/media/media-voice-generation-types"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import { buildSharePageTemplatePreviewMergeValues } from "@/lib/growth/share-pages/share-page-template-preview-context"

function buildMergeValues(context: GrowthMediaVoicePersonalizationContext): Record<string, string> {
  return buildSharePageTemplatePreviewMergeValues({
    prospectName: context.prospectName ?? "Prospect",
    companyName: context.companyName ?? "Company",
    senderName: context.senderName ?? "Sender",
    senderCompany: context.senderCompany ?? "Equipify",
    bookingLinkOverride: "",
    customMergeValues: context.customMergeValues ?? {},
    analyticsPreviewMode: true,
    aiVideoPreviewMode: true,
    voiceClonePreviewMode: true,
    conversationalAgentPreviewMode: true,
    aiQaPreviewMode: true,
    bookingHandoffPreviewMode: true,
  })
}

export function buildPersonalizedVoiceScriptPreview(input: {
  scriptTemplate: string
  personalizationContext?: GrowthMediaVoicePersonalizationContext
  fallbackText?: string
}): GrowthMediaVoiceGenerationScriptPreview {
  const mergeFieldsUsed = extractContentMergeFields(input.scriptTemplate)
  const mergeValues = buildMergeValues(input.personalizationContext ?? {})
  const resolved = applySharePageTemplateMergeFields(input.scriptTemplate, mergeValues).trim()
  const hasUnresolvedTokens = /\{\{/.test(resolved)
  const fallback = input.fallbackText?.trim() || "Personalized voice script preview"
  return {
    scriptTemplate: input.scriptTemplate,
    resolvedScript: hasUnresolvedTokens ? fallback : resolved || fallback,
    mergeFieldsUsed,
    usedFallback: hasUnresolvedTokens || !resolved,
  }
}
