/** Growth Engine B3 — Thumbnail preview helpers (client-safe). */

import {
  buildGrowthVideoPreviewFormMergeValues,
} from "@/lib/growth/videos/growth-video-preview-render-service"
import {
  computeGrowthVideoThumbnailScore,
  growthVideoThumbnailSvgDataUrl,
  renderGrowthVideoThumbnailSvg,
} from "@/lib/growth/videos/growth-video-thumbnail-render-service"
import type {
  GrowthVideoThumbnailAiPayload,
  GrowthVideoThumbnailPreviewFormInput,
  GrowthVideoThumbnailRenderResult,
  GrowthVideoThumbnailType,
} from "@/lib/growth/videos/growth-video-types"

export function buildGrowthVideoThumbnailPreviewMergeValues(
  form: GrowthVideoThumbnailPreviewFormInput,
): Record<string, string> {
  return buildGrowthVideoPreviewFormMergeValues({
    firstName: form.firstName,
    lastName: form.lastName,
    company: form.company,
    industry: form.industry,
    title: form.title,
    ctaUrl: form.ctaLabel,
  })
}

export function previewGrowthVideoThumbnail(input: {
  type: GrowthVideoThumbnailType
  form: GrowthVideoThumbnailPreviewFormInput
  primaryColor?: string | null
  pageTitle?: string | null
  sourcesUsed?: string[]
}): {
  mergeValues: Record<string, string>
  thumbnail: GrowthVideoThumbnailRenderResult
  og: GrowthVideoThumbnailRenderResult
  previewDataUrl: string
  ogPreviewDataUrl: string
  aiPayload: GrowthVideoThumbnailAiPayload
} {
  const mergeValues = buildGrowthVideoThumbnailPreviewMergeValues(input.form)
  const thumbnail = renderGrowthVideoThumbnailSvg({
    type: input.type === "open_graph" ? "prospect" : input.type,
    mergeValues,
    primaryColor: input.primaryColor,
    ctaLabel: input.form.ctaLabel,
    pageTitle: input.pageTitle,
  })
  const og = renderGrowthVideoThumbnailSvg({
    type: "open_graph",
    mergeValues,
    primaryColor: input.primaryColor,
    ctaLabel: input.form.ctaLabel,
    pageTitle: input.pageTitle,
  })

  const aiPayload: GrowthVideoThumbnailAiPayload = {
    thumbnail_variables: {
      first_name: mergeValues.first_name ?? mergeValues["lead.first_name"] ?? "",
      company: mergeValues.company ?? mergeValues["lead.company_name"] ?? "",
      industry: mergeValues.industry ?? mergeValues["lead.industry"] ?? "",
      title: mergeValues.title ?? mergeValues["lead.title"] ?? "",
      cta_label: input.form.ctaLabel ?? "",
      company_logo_url: input.form.companyLogoUrl ?? "",
    },
    resolved_values: mergeValues,
    rendered_thumbnail_url: growthVideoThumbnailSvgDataUrl(thumbnail.svg),
    rendered_og_image_url: growthVideoThumbnailSvgDataUrl(og.svg),
    sources_used: input.sourcesUsed ?? ["preview_form", "growth_video_thumbnail_render"],
    thumbnail_score: computeGrowthVideoThumbnailScore({ mergeValues }),
  }

  return {
    mergeValues,
    thumbnail,
    og,
    previewDataUrl: growthVideoThumbnailSvgDataUrl(thumbnail.svg),
    ogPreviewDataUrl: growthVideoThumbnailSvgDataUrl(og.svg),
    aiPayload,
  }
}
