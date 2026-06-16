/** Growth Engine S1-E — compile published template versions into SR-2 share page fields (client-safe). */

import { GROWTH_CONTENT_MERGE_FIELD_RE } from "@/lib/growth/content/merge-field-validator"
import { isTemplateBlockEnabled } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import type {
  GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"
import type {
  GrowthSharePageCTA,
  GrowthSharePageHeroMediaType,
  GrowthSharePageResource,
  GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"
import { DEFAULT_GROWTH_SHARE_PAGE_THEME } from "@/lib/growth/share-pages/share-page-types"

export type SharePageTemplateMergeContext = {
  prospectName: string
  companyName: string
  bookingLink?: string | null
}

export type CompiledSharePageFromTemplate = {
  headline: string
  subheadline: string | null
  heroMessage: string
  whyReachingOut: string | null
  companyObservations: string[]
  ctaConfig: GrowthSharePageCTA[]
  resources: GrowthSharePageResource[]
  theme: GrowthSharePageTheme
  bookingPageId: string | null
  heroMediaType: GrowthSharePageHeroMediaType
  heroMediaUrl: string | null
  heroMediaThumbnailUrl: string | null
  voiceAssetId: string | null
  videoAssetId: string | null
  templateBlocksSnapshot: GrowthSharePageTemplateBlock[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asAssetId(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || !UUID_RE.test(trimmed)) return null
  return trimmed
}

export function buildSharePageTemplateMergeValues(
  context: SharePageTemplateMergeContext,
): Record<string, string> {
  return {
    "lead.contact_name": context.prospectName,
    "lead.company_name": context.companyName,
    "company.name": context.companyName,
    "prospect.name": context.prospectName,
    "prospect.company": context.companyName,
    "booking.link": context.bookingLink ?? "",
  }
}

export function applySharePageTemplateMergeFields(
  text: string,
  mergeValues: Record<string, string>,
): string {
  return text.replace(GROWTH_CONTENT_MERGE_FIELD_RE, (match, key: string) => {
    const normalized = key.trim().toLowerCase()
    return mergeValues[normalized] ?? mergeValues[key.trim()] ?? match
  })
}

function applyMergeFieldsToBlock(
  block: GrowthSharePageTemplateBlock,
  mergeValues: Record<string, string>,
  options?: { preserveOverlayTemplates?: boolean },
): GrowthSharePageTemplateBlock {
  const clone = structuredClone(block) as GrowthSharePageTemplateBlock & Record<string, unknown>

  function walk(value: unknown, path: string[] = []): unknown {
    if (typeof value === "string") {
      if (options?.preserveOverlayTemplates !== false && path.join(".").includes("overlaySpec")) {
        return value
      }
      if (options?.preserveOverlayTemplates !== false && path.join(".").includes("aiVideo")) {
        return value
      }
      return applySharePageTemplateMergeFields(value, mergeValues)
    }
    if (Array.isArray(value)) return value.map((entry) => walk(entry, path))
    if (value && typeof value === "object") {
      const next: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        next[key] = walk(nested, [...path, key])
      }
      return next
    }
    return value
  }

  return walk(clone) as GrowthSharePageTemplateBlock
}

function resourceFromTextBlock(block: Extract<GrowthSharePageTemplateBlock, { type: "text" }>): GrowthSharePageResource | null {
  if (!block.body.trim() && !block.heading?.trim()) return null
  return {
    id: block.id,
    title: block.heading?.trim() || "Section",
    description: block.body.trim() || null,
    kind: "one_pager",
    url: `#template-section-${block.id}`,
    thumbnailUrl: null,
  }
}

function resourceFromCustomBlock(
  block: Extract<GrowthSharePageTemplateBlock, { type: "custom" }>,
): GrowthSharePageResource | null {
  if (!block.htmlSafeText.trim()) return null
  return {
    id: block.id,
    title: block.label?.trim() || "Custom section",
    description: block.htmlSafeText.trim(),
    kind: "link",
    url: `#template-section-${block.id}`,
    thumbnailUrl: null,
  }
}

function resourceFromImageBlock(
  block: Extract<GrowthSharePageTemplateBlock, { type: "image" }>,
): GrowthSharePageResource | null {
  if (!block.imageUrl?.trim()) return null
  return {
    id: block.id,
    title: block.altText.trim() || "Image",
    description: block.caption,
    kind: "link",
    url: block.imageUrl,
    thumbnailUrl: block.imageUrl,
  }
}

export function compileTemplateVersionToSharePageFields(input: {
  version: GrowthSharePageTemplateVersion
  mergeContext: SharePageTemplateMergeContext
  bookingPageIdOverride?: string | null
}): CompiledSharePageFromTemplate {
  const mergeValues = buildSharePageTemplateMergeValues(input.mergeContext)
  const activeBlocks = input.version.blocks
    .filter(isTemplateBlockEnabled)
    .map((block) => applyMergeFieldsToBlock(block, mergeValues, { preserveOverlayTemplates: true }))
    .sort((a, b) => a.order - b.order)

  const theme = { ...DEFAULT_GROWTH_SHARE_PAGE_THEME, ...input.version.theme }

  let headline = `A note for ${input.mergeContext.companyName}`
  let subheadline: string | null = null
  let heroMessage = ""
  let whyReachingOut: string | null = null
  let heroMediaType: GrowthSharePageHeroMediaType = "none"
  let heroMediaUrl: string | null = null
  let heroMediaThumbnailUrl: string | null = null
  let bookingPageId = input.bookingPageIdOverride ?? input.version.defaultBookingPageId ?? null
  let voiceAssetId: string | null = null
  let videoAssetId: string | null = null
  const companyObservations: string[] = []
  const ctaConfig: GrowthSharePageCTA[] = []
  const resources: GrowthSharePageResource[] = []

  for (const block of activeBlocks) {
    switch (block.type) {
      case "hero":
        headline = block.headline || headline
        subheadline = block.subheadline
        heroMessage = block.heroMessage
        heroMediaType = block.heroMediaType ?? "none"
        heroMediaUrl = block.heroMediaUrl ?? null
        heroMediaThumbnailUrl = block.heroMediaThumbnailUrl ?? null
        if (block.showLogo === false) theme.logoUrl = null
        break
      case "text": {
        const resource = resourceFromTextBlock(block)
        if (resource) resources.push(resource)
        if (block.heading && !whyReachingOut) whyReachingOut = block.heading
        if (block.body) {
          heroMessage = heroMessage ? `${heroMessage}\n\n${block.body}` : block.body
        }
        break
      }
      case "image": {
        const resource = resourceFromImageBlock(block)
        if (resource) resources.push(resource)
        if (heroMediaType === "none" && block.imageUrl) {
          heroMediaType = "image"
          heroMediaUrl = block.imageUrl
        }
        break
      }
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
        bookingPageId = input.bookingPageIdOverride ?? block.bookingPageId ?? bookingPageId
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
      case "custom": {
        const resource = resourceFromCustomBlock(block)
        if (resource) resources.push(resource)
        break
      }
      case "video_placeholder":
        videoAssetId = asAssetId(block.videoAssetId) ?? asAssetId(block.mediaAssetRef) ?? videoAssetId
        resources.push({
          id: block.id,
          title: block.placeholderLabel,
          description: block.heading,
          kind: "link",
          url: `#template-video-${block.id}`,
          thumbnailUrl: null,
        })
        break
      case "voice_placeholder":
        voiceAssetId = asAssetId(block.mediaAssetRef) ?? voiceAssetId
        resources.push({
          id: block.id,
          title: block.placeholderLabel,
          description: block.heading,
          kind: "link",
          url: `#template-voice-${block.id}`,
          thumbnailUrl: null,
        })
        break
      case "media_cta_placeholder":
        ctaConfig.push({
          id: block.id,
          label: block.ctaLabel || block.placeholderLabel,
          kind: "secondary",
          action: "open_url",
          destinationUrl: `#template-media-cta-${block.id}`,
          resourceId: null,
          trackingKey: `template_media_cta_${block.id}`,
        })
        resources.push({
          id: `${block.id}-snapshot`,
          title: block.placeholderLabel,
          description: block.heading,
          kind: "link",
          url: `#template-media-cta-${block.id}`,
          thumbnailUrl: null,
        })
        break
    }
  }

  return {
    headline,
    subheadline,
    heroMessage,
    whyReachingOut,
    companyObservations,
    ctaConfig,
    resources,
    theme,
    bookingPageId,
    heroMediaType,
    heroMediaUrl,
    heroMediaThumbnailUrl,
    voiceAssetId,
    videoAssetId,
    templateBlocksSnapshot: activeBlocks,
  }
}
