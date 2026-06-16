/** Growth Engine S1-C — map template editor state to share page render model (client-safe). */

import type {
  GrowthSharePageCTA,
  GrowthSharePageRenderModel,
  GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import { isTemplateBlockEnabled } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export type GrowthSharePageTemplatePreviewBlock = {
  id: string
  type: GrowthSharePageTemplateBlock["type"]
  label: string
  detail?: string
}

export type GrowthSharePageTemplatePreviewModel = {
  renderModel: GrowthSharePageRenderModel
  extraBlocks: GrowthSharePageTemplatePreviewBlock[]
}

export function mapTemplateEditorToRenderModel(input: {
  blocks: GrowthSharePageTemplateBlock[]
  theme: GrowthSharePageTheme
  prospectName: string
  companyName: string
  defaultBookingPageId?: string | null
  bookingSlug?: string | null
}): GrowthSharePageTemplatePreviewModel {
  const activeBlocks = input.blocks.filter(isTemplateBlockEnabled)
  const theme = { ...DEFAULT_GROWTH_SHARE_PAGE_THEME, ...input.theme }
  if (theme.logoUrl && activeBlocks.some((block) => block.type === "hero" && block.showLogo === false)) {
    theme.logoUrl = null
  }

  let headline = `A note for ${input.companyName}`
  let subheadline: string | null = null
  let heroMessage = ""
  let whyReachingOut: string | null = null
  let heroMediaType: GrowthSharePageRenderModel["heroMediaType"] = "none"
  let heroMediaUrl: string | null = null
  let heroMediaThumbnailUrl: string | null = null
  const companyObservations: string[] = []
  const ctaConfig: GrowthSharePageCTA[] = []
  const extraBlocks: GrowthSharePageTemplatePreviewBlock[] = []
  let bookingPageId = input.defaultBookingPageId ?? null

  for (const block of activeBlocks) {
    switch (block.type) {
      case "hero":
        headline = block.headline || headline
        subheadline = block.subheadline
        heroMessage = block.heroMessage
        heroMediaType = block.heroMediaType ?? "none"
        heroMediaUrl = block.heroMediaUrl ?? null
        heroMediaThumbnailUrl = block.heroMediaThumbnailUrl ?? null
        break
      case "text":
        if (block.heading && !whyReachingOut) whyReachingOut = block.heading
        if (block.body) {
          heroMessage = heroMessage ? `${heroMessage}\n\n${block.body}` : block.body
        }
        break
      case "image":
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label: block.altText || "Image section",
          detail: block.caption ?? block.imageUrl ?? undefined,
        })
        if (heroMediaType === "none" && block.imageUrl) {
          heroMediaType = "image"
          heroMediaUrl = block.imageUrl
        }
        break
      case "cta":
        ctaConfig.push({
          id: block.id,
          label: block.label,
          kind: block.kind,
          action: block.action,
          destinationUrl: block.destinationUrl,
          resourceId: null,
          trackingKey: block.trackingKey,
        })
        break
      case "calendar":
        bookingPageId = block.bookingPageId ?? bookingPageId
        break
      case "testimonials":
        for (const item of block.items) {
          if (!item.quote.trim()) continue
          companyObservations.push(
            `"${item.quote}" — ${item.authorName}${item.authorTitle ? `, ${item.authorTitle}` : ""}${
              item.companyName ? ` (${item.companyName})` : ""
            }`,
          )
        }
        break
      case "custom":
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label: block.label ?? "Custom section",
          detail: block.htmlSafeText,
        })
        break
      case "video_placeholder":
      case "voice_placeholder":
      case "media_cta_placeholder":
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label:
            block.type === "media_cta_placeholder"
              ? block.ctaLabel || block.placeholderLabel
              : block.placeholderLabel,
          detail: block.heading ?? undefined,
        })
        break
    }
  }

  const booking =
    bookingPageId || input.bookingSlug
      ? {
          bookingPageId: bookingPageId ?? "preview-booking-page",
          slug: input.bookingSlug ?? "preview-booking",
          name: "Book a meeting",
          bookingUrl: input.bookingSlug ? `/book/${input.bookingSlug}` : "/book/preview-booking",
          embedUrl: input.bookingSlug ? `/book/${input.bookingSlug}?embed=1` : "/book/preview-booking?embed=1",
          disabled: true,
        }
      : null

  return {
    renderModel: {
      sharePageId: "template-preview",
      publicToken: null,
      prospectName: input.prospectName,
      companyName: input.companyName,
      headline,
      subheadline,
      heroMessage,
      whyReachingOut,
      companyObservations,
      ctaConfig,
      resources: [],
      theme,
      heroMediaType,
      heroMediaUrl,
      heroMediaThumbnailUrl,
      voiceAssetId: null,
      videoAssetId: null,
      previewMode: true,
      booking,
    },
    extraBlocks,
  }
}
