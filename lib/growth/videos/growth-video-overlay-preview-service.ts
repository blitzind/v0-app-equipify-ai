/** Growth Engine B2 — Overlay preview + AI payload helpers (client-safe). */

import {
  buildGrowthVideoPreviewFormMergeValues,
  extractGrowthVideoMissingTokens,
} from "@/lib/growth/videos/growth-video-preview-render-service"
import { resolveGrowthVideoOverlayPreviewItems } from "@/lib/growth/videos/growth-video-overlay-render-service"
import { buildGrowthVideoBrandingPreview } from "@/lib/growth/videos/growth-video-branding-service"
import type {
  GrowthVideoOverlayAiPayload,
  GrowthVideoOverlayB2Config,
  GrowthVideoOverlayPreviewFormInput,
  GrowthVideoOverlayResolvedPreviewItem,
  GrowthVideoPageBranding,
} from "@/lib/growth/videos/growth-video-types"

export function buildGrowthVideoOverlayPreviewMergeValues(
  form: GrowthVideoOverlayPreviewFormInput,
): Record<string, string> {
  const base = buildGrowthVideoPreviewFormMergeValues({
    firstName: form.firstName,
    lastName: form.lastName,
    company: form.company,
    industry: form.industry,
    title: form.title,
    senderName: form.senderName,
    ctaUrl: form.ctaLabel,
  })
  const senderCompany = form.senderCompany?.trim() ?? ""
  if (senderCompany) {
    base["sender.company"] = senderCompany
    base.company = senderCompany
  }
  return base
}

export function computeGrowthVideoOverlayScore(input: {
  config: GrowthVideoOverlayB2Config
  mergeValues: Record<string, string>
}): number {
  const enabledItems = input.config.items.filter((item) => item.enabled)
  if (!input.config.enabled || enabledItems.length === 0) return 0

  let resolvedCount = 0
  for (const item of enabledItems) {
    const missing = extractGrowthVideoMissingTokens(item.textTemplate, input.mergeValues)
    if (missing.length === 0) resolvedCount += 1
  }
  return Math.round((resolvedCount / enabledItems.length) * 100)
}

export function buildGrowthVideoOverlayAiPayload(input: {
  config: GrowthVideoOverlayB2Config
  mergeValues: Record<string, string>
  previewItems: GrowthVideoOverlayResolvedPreviewItem[]
  sourcesUsed?: string[]
}): GrowthVideoOverlayAiPayload {
  const missing = new Set<string>()
  for (const item of input.config.items) {
    if (!item.enabled) continue
    for (const token of extractGrowthVideoMissingTokens(item.textTemplate, input.mergeValues)) {
      missing.add(token)
    }
  }

  return {
    overlay_variables: {
      first_name: input.mergeValues.first_name ?? input.mergeValues["lead.first_name"] ?? "",
      company: input.mergeValues.company ?? input.mergeValues["lead.company_name"] ?? "",
      industry: input.mergeValues.industry ?? input.mergeValues["lead.industry"] ?? "",
      title: input.mergeValues.title ?? input.mergeValues["lead.title"] ?? "",
      sender_name: input.mergeValues["sender.name"] ?? "",
      sender_company: input.mergeValues["sender.company"] ?? "",
    },
    resolved_values: input.mergeValues,
    overlay_items: input.previewItems.map((item) => ({
      id: item.id,
      type: item.type,
      resolved_text: item.resolvedText,
      position: item.position,
    })),
    missing_variables: [...missing],
    sources_used: input.sourcesUsed ?? ["preview_form", "growth_video_overlay_render"],
    overlay_score: computeGrowthVideoOverlayScore({
      config: input.config,
      mergeValues: input.mergeValues,
    }),
  }
}

export function previewGrowthVideoOverlays(input: {
  config: GrowthVideoOverlayB2Config
  pageBranding: GrowthVideoPageBranding
  previewForm: GrowthVideoOverlayPreviewFormInput
  sourcesUsed?: string[]
}): {
  mergeValues: Record<string, string>
  brandingPreview: ReturnType<typeof buildGrowthVideoBrandingPreview>
  previewItems: GrowthVideoOverlayResolvedPreviewItem[]
  aiPayload: GrowthVideoOverlayAiPayload
} {
  const mergeValues = buildGrowthVideoOverlayPreviewMergeValues(input.previewForm)
  const brandingPreview = buildGrowthVideoBrandingPreview(
    input.pageBranding,
    input.config.branding,
  )
  const previewItems = resolveGrowthVideoOverlayPreviewItems({
    config: input.config,
    mergeValues,
    accentColor: brandingPreview.accentColor,
  })
  const aiPayload = buildGrowthVideoOverlayAiPayload({
    config: input.config,
    mergeValues,
    previewItems,
    sourcesUsed: input.sourcesUsed,
  })

  return { mergeValues, brandingPreview, previewItems, aiPayload }
}
