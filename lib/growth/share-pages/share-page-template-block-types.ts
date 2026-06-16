/** Growth Engine S1-B — Share Page Template block model (client-safe). */

export const GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES = [
  "hero",
  "text",
  "image",
  "cta",
  "calendar",
  "testimonials",
  "custom",
  "video_placeholder",
  "voice_placeholder",
  "media_cta_placeholder",
] as const

export type GrowthSharePageTemplateBlockType = (typeof GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES)[number]

export type GrowthSharePageTemplateBlockBase = {
  id: string
  type: GrowthSharePageTemplateBlockType
  order: number
  label?: string
  enabled?: boolean
}

export type GrowthSharePageTemplateHeroBlock = GrowthSharePageTemplateBlockBase & {
  type: "hero"
  headline: string
  subheadline: string | null
  heroMessage: string
  showLogo?: boolean
  heroMediaType?: "none" | "image" | "video"
  heroMediaUrl?: string | null
  heroMediaThumbnailUrl?: string | null
}

export type GrowthSharePageTemplateTextBlock = GrowthSharePageTemplateBlockBase & {
  type: "text"
  heading: string | null
  body: string
}

export type GrowthSharePageTemplateImageBlock = GrowthSharePageTemplateBlockBase & {
  type: "image"
  imageUrl: string | null
  altText: string
  caption: string | null
}

export type GrowthSharePageTemplateCtaBlock = GrowthSharePageTemplateBlockBase & {
  type: "cta"
  label: string
  kind: "primary" | "secondary" | "link"
  action: "book_meeting" | "open_url" | "download_resource" | "reply_email"
  destinationUrl: string | null
  trackingKey: string
}

export type GrowthSharePageTemplateCalendarBlock = GrowthSharePageTemplateBlockBase & {
  type: "calendar"
  heading: string | null
  bookingPageId: string | null
  embedMode?: "inline" | "button"
}

export type GrowthSharePageTemplateTestimonialEntry = {
  id: string
  quote: string
  authorName: string
  authorTitle: string | null
  companyName: string | null
}

export type GrowthSharePageTemplateTestimonialsBlock = GrowthSharePageTemplateBlockBase & {
  type: "testimonials"
  heading: string | null
  items: GrowthSharePageTemplateTestimonialEntry[]
}

export type GrowthSharePageTemplateCustomBlock = GrowthSharePageTemplateBlockBase & {
  type: "custom"
  htmlSafeText: string
}

export type GrowthSharePageTemplateVideoPlaceholderBlock = GrowthSharePageTemplateBlockBase & {
  type: "video_placeholder"
  heading: string | null
  placeholderLabel: string
  mediaAssetRef: string | null
  layout?: "wide" | "compact"
}

export type GrowthSharePageTemplateVoicePlaceholderBlock = GrowthSharePageTemplateBlockBase & {
  type: "voice_placeholder"
  heading: string | null
  placeholderLabel: string
  mediaAssetRef: string | null
  showTranscript?: boolean
}

export type GrowthSharePageTemplateMediaCtaPlaceholderBlock = GrowthSharePageTemplateBlockBase & {
  type: "media_cta_placeholder"
  heading: string | null
  placeholderLabel: string
  ctaLabel: string
  mediaAssetRef: string | null
  linkedBlockId?: string | null
}

export type GrowthSharePageTemplateBlock =
  | GrowthSharePageTemplateHeroBlock
  | GrowthSharePageTemplateTextBlock
  | GrowthSharePageTemplateImageBlock
  | GrowthSharePageTemplateCtaBlock
  | GrowthSharePageTemplateCalendarBlock
  | GrowthSharePageTemplateTestimonialsBlock
  | GrowthSharePageTemplateCustomBlock
  | GrowthSharePageTemplateVideoPlaceholderBlock
  | GrowthSharePageTemplateVoicePlaceholderBlock
  | GrowthSharePageTemplateMediaCtaPlaceholderBlock

export function isGrowthSharePageTemplateBlockType(value: string): value is GrowthSharePageTemplateBlockType {
  return (GROWTH_SHARE_PAGE_TEMPLATE_BLOCK_TYPES as readonly string[]).includes(value)
}
