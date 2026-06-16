/** Growth Engine S1-B/S2-E — Share Page Template block model (client-safe). */

import type { GrowthMediaAiQaKnowledgeSourceRef } from "@/lib/growth/media/media-ai-qa-knowledge-types"
import type { GrowthMediaVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-types"

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

export type GrowthSharePageTemplateVideoVoiceCloneSettings = {
  enabled: boolean
  voiceId?: string | null
  scriptTemplate?: string | null
  mergeFieldsUsed?: string[]
}

export type GrowthSharePageTemplateVideoAiQaSettings = {
  enabled: boolean
  policyId?: string | null
  questionPromptTemplate?: string | null
  fallbackResponse?: string | null
  knowledgeSourceRefs?: GrowthMediaAiQaKnowledgeSourceRef[]
  mergeFieldsUsed?: string[]
  bookingHandoffEnabled?: boolean
}

export type GrowthSharePageTemplateVideoBookingHandoffSettings = {
  enabled: boolean
  readinessTier?: string | null
  readinessScore?: number | null
  recommendedMeetingType?: string | null
  recommendedDurationMinutes?: number | null
  recommendedAttendees?: string[]
  bookingRecommendation?: string | null
  agendaTemplate?: string | null
  nextSteps?: string[]
}

export type GrowthSharePageTemplateVideoConversationalAgentSettings = {
  enabled: boolean
  agentId?: string | null
  qualificationGoal?: string | null
  systemPromptTemplate?: string | null
  mergeFieldsUsed?: string[]
  aiQa?: GrowthSharePageTemplateVideoAiQaSettings | null
  bookingHandoff?: GrowthSharePageTemplateVideoBookingHandoffSettings | null
}

export type GrowthSharePageTemplateVideoAiVideoSettings = {
  enabled: boolean
  avatarId?: string | null
  scriptTemplate?: string | null
  mergeFieldsUsed?: string[]
  voiceClone?: GrowthSharePageTemplateVideoVoiceCloneSettings | null
  conversationalAgent?: GrowthSharePageTemplateVideoConversationalAgentSettings | null
}

export type GrowthSharePageTemplateVideoPlaceholderSettings = {
  overlaySpec?: GrowthMediaVideoOverlaySpec | null
  aiVideo?: GrowthSharePageTemplateVideoAiVideoSettings | null
}

export type GrowthSharePageTemplateVideoPlaceholderBlock = GrowthSharePageTemplateBlockBase & {
  type: "video_placeholder"
  heading: string | null
  placeholderLabel: string
  /** S2-A persisted media asset reference (preferred). */
  videoAssetId?: string | null
  mediaAssetRef: string | null
  layout?: "wide" | "compact"
  /** S2-E overlay specifications — merge templates preserved until preview/instantiation render. */
  settings?: GrowthSharePageTemplateVideoPlaceholderSettings | null
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
