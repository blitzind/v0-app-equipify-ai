import type {
  GrowthSharePage,
  GrowthSharePagePersonalizationContext,
  GrowthSharePageRenderModel,
} from "@/lib/growth/share-pages/share-page-types"

export function readSharePagePersonalizationSnapshot(
  value: GrowthSharePage["personalizationSnapshot"],
): GrowthSharePagePersonalizationContext | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.prospectName !== "string" || typeof record.companyName !== "string") return null
  return value as GrowthSharePagePersonalizationContext
}

export function mapSharePageToRenderModel(
  page: GrowthSharePage,
  input: {
    prospectName: string
    companyName: string
    previewMode: boolean
    publicToken?: string | null
    booking?: GrowthSharePageRenderModel["booking"]
  },
): GrowthSharePageRenderModel {
  const snapshot = readSharePagePersonalizationSnapshot(page.personalizationSnapshot)

  return {
    sharePageId: page.id,
    publicToken: input.previewMode ? null : input.publicToken ?? null,
    prospectName: input.prospectName,
    companyName: input.companyName,
    headline: page.headline || snapshot?.headline || `A note for ${input.companyName}`,
    subheadline: page.subheadline,
    heroMessage: page.heroMessage || snapshot?.personalizedMessage || "",
    whyReachingOut: page.whyReachingOut || snapshot?.whyReachingOut || null,
    companyObservations:
      page.companyObservations.length > 0
        ? page.companyObservations
        : snapshot?.companyObservations ?? [],
    ctaConfig: page.ctaConfig.length > 0 ? page.ctaConfig : snapshot?.suggestedCta ? [snapshot.suggestedCta] : [],
    resources: page.resources.length > 0 ? page.resources : snapshot?.resources ?? [],
    theme: page.theme,
    heroMediaType: page.heroMediaType,
    heroMediaUrl: page.heroMediaUrl,
    heroMediaThumbnailUrl: page.heroMediaThumbnailUrl,
    voiceAssetId: page.voiceAssetId,
    videoAssetId: page.videoAssetId,
    previewMode: input.previewMode,
    booking: input.booking ?? null,
  }
}
