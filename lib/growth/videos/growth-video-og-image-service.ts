import "server-only"

import type { GrowthVideoThumbnailRenderResult } from "@/lib/growth/videos/growth-video-types"
import { renderGrowthVideoThumbnailSvg } from "@/lib/growth/videos/growth-video-thumbnail-render-service"

/** Growth Engine B3 — Open Graph image composition (reuses thumbnail render service). */

export function renderGrowthVideoOgImageSvg(input: {
  mergeValues: Record<string, string>
  primaryColor?: string | null
  ctaLabel?: string | null
  pageTitle?: string | null
}): GrowthVideoThumbnailRenderResult {
  return renderGrowthVideoThumbnailSvg({
    type: "open_graph",
    mergeValues: input.mergeValues,
    primaryColor: input.primaryColor,
    ctaLabel: input.ctaLabel,
    pageTitle: input.pageTitle,
  })
}

export function buildGrowthVideoOgMetadata(input: {
  title: string
  description?: string | null
  ogImageUrl?: string | null
}) {
  return {
    title: input.title,
    description: input.description ?? undefined,
    openGraph: {
      title: input.title,
      description: input.description ?? undefined,
      images: input.ogImageUrl ? [{ url: input.ogImageUrl }] : undefined,
    },
    twitter: input.ogImageUrl
      ? {
          card: "summary_large_image" as const,
          title: input.title,
          description: input.description ?? undefined,
          images: [input.ogImageUrl],
        }
      : undefined,
  }
}
