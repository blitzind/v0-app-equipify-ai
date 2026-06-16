/** Growth Engine S1-C/S1-F — map template editor state to share page render model (client-safe). */

import {
  applySharePageTemplateMergeFields,
} from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import type {
  GrowthSharePageTemplatePreviewContext,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import {
  buildSharePageTemplatePreviewMergeValues,
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import type { GrowthMediaVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-types"
import type { GrowthSharePageTemplateVideoAiVideoSettings } from "@/lib/growth/share-pages/share-page-template-block-types"
import { isTemplateBlockEnabled } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import type {
  GrowthSharePageCTA,
  GrowthSharePageRenderModel,
  GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export type GrowthSharePageTemplatePreviewBlock = {
  id: string
  type: GrowthSharePageTemplateBlock["type"]
  label: string
  detail?: string
  heading?: string | null
  layout?: "wide" | "compact"
  showTranscript?: boolean
  videoAssetId?: string | null
  thumbnailPreviewUrl?: string | null
  overlaySpec?: GrowthMediaVideoOverlaySpec | null
  aiVideo?: GrowthSharePageTemplateVideoAiVideoSettings | null
  ctaLabel?: string
}

export type GrowthSharePageTemplatePreviewModel = {
  renderModel: GrowthSharePageRenderModel
  extraBlocks: GrowthSharePageTemplatePreviewBlock[]
}

function applyPreviewMergeToBlock(
  block: GrowthSharePageTemplateBlock,
  mergeValues: Record<string, string>,
): GrowthSharePageTemplateBlock {
  const clone = structuredClone(block) as GrowthSharePageTemplateBlock & Record<string, unknown>

  function walk(value: unknown): unknown {
    if (typeof value === "string") return applySharePageTemplateMergeFields(value, mergeValues)
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === "object") {
      const next: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        next[key] = walk(nested)
      }
      return next
    }
    return value
  }

  return walk(clone) as GrowthSharePageTemplateBlock
}

export function mapTemplateEditorToRenderModel(input: {
  blocks: GrowthSharePageTemplateBlock[]
  theme: GrowthSharePageTheme
  previewContext?: GrowthSharePageTemplatePreviewContext
  prospectName?: string
  companyName?: string
  defaultBookingPageId?: string | null
  bookingSlug?: string | null
}): GrowthSharePageTemplatePreviewModel {
  const previewContext: GrowthSharePageTemplatePreviewContext = input.previewContext ?? {
    ...DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
    prospectName: input.prospectName ?? DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.prospectName,
    companyName: input.companyName ?? DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT.companyName,
  }
  const mergeValues = buildSharePageTemplatePreviewMergeValues(previewContext)
  const activeBlocks = input.blocks
    .filter(isTemplateBlockEnabled)
    .map((block) => applyPreviewMergeToBlock(block, mergeValues))
    .sort((a, b) => a.order - b.order)

  const theme = { ...DEFAULT_GROWTH_SHARE_PAGE_THEME, ...input.theme }
  if (theme.logoUrl && activeBlocks.some((block) => block.type === "hero" && block.showLogo === false)) {
    theme.logoUrl = null
  }

  let headline = `A note for ${previewContext.companyName}`
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
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label: block.placeholderLabel,
          heading: block.heading,
          layout: block.layout ?? "wide",
          videoAssetId: block.videoAssetId ?? block.mediaAssetRef ?? null,
          overlaySpec: block.settings?.overlaySpec ?? null,
          aiVideo: block.settings?.aiVideo ?? null,
        })
        break
      case "voice_placeholder":
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label: block.placeholderLabel,
          heading: block.heading,
          showTranscript: block.showTranscript,
        })
        break
      case "media_cta_placeholder":
        extraBlocks.push({
          id: block.id,
          type: block.type,
          label: block.placeholderLabel,
          heading: block.heading,
          ctaLabel: block.ctaLabel,
        })
        break
    }
  }

  const bookingSlug = input.bookingSlug ?? null
  const bookingLinkOverride = previewContext.bookingLinkOverride.trim()
  const booking =
    bookingPageId || bookingSlug || bookingLinkOverride
      ? {
          bookingPageId: bookingPageId ?? "preview-booking-page",
          slug: bookingSlug ?? "preview-booking",
          name: "Book a meeting",
          bookingUrl: bookingLinkOverride || (bookingSlug ? `/book/${bookingSlug}` : "/book/preview-booking"),
          embedUrl: bookingLinkOverride
            ? `${bookingLinkOverride}${bookingLinkOverride.includes("?") ? "&" : "?"}embed=1`
            : bookingSlug
              ? `/book/${bookingSlug}?embed=1`
              : "/book/preview-booking?embed=1",
          disabled: true,
        }
      : null

  return {
    renderModel: {
      sharePageId: "template-preview",
      publicToken: null,
      prospectName: previewContext.prospectName,
      companyName: previewContext.companyName,
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
