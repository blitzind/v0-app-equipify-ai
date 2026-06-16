/** Growth Engine S2-F — client-safe generation helpers (no provider execution). */

import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type {
  GrowthMediaVideoGenerationScriptPreview,
  GrowthMediaVideoPersonalizationContext,
} from "@/lib/growth/media/media-video-generation-types"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import { buildSharePageTemplatePreviewMergeValues } from "@/lib/growth/share-pages/share-page-template-preview-context"

function buildMergeValues(context: GrowthMediaVideoPersonalizationContext): Record<string, string> {
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

export function buildPersonalizedScriptPreview(input: {
  scriptTemplate: string
  personalizationContext?: GrowthMediaVideoPersonalizationContext
  fallbackText?: string
}): GrowthMediaVideoGenerationScriptPreview {
  const mergeFieldsUsed = extractContentMergeFields(input.scriptTemplate)
  const mergeValues = buildMergeValues(input.personalizationContext ?? {})
  const resolved = applySharePageTemplateMergeFields(input.scriptTemplate, mergeValues).trim()
  const hasUnresolvedTokens = /\{\{/.test(resolved)
  const fallback = input.fallbackText?.trim() || "Personalized video script preview"
  return {
    scriptTemplate: input.scriptTemplate,
    resolvedScript: hasUnresolvedTokens ? fallback : resolved || fallback,
    mergeFieldsUsed,
    usedFallback: hasUnresolvedTokens || !resolved,
  }
}

export function normalizeVideoAiSettingsMergeFields(input: {
  scriptTemplate?: string | null
  mergeFieldsUsed?: string[]
}): string[] {
  return extractContentMergeFields(input.scriptTemplate ?? "")
}
