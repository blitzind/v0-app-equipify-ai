/** Growth Engine S2-E — personalized video overlay specifications (client-safe, no rendering). */

export const GROWTH_MEDIA_VIDEO_OVERLAY_QA_MARKER = "growth-media-video-overlays-s2e-v1" as const

export const GROWTH_MEDIA_VIDEO_OVERLAY_TYPES = [
  "text",
  "cta",
  "badge",
  "lower_third",
  "intro_title",
] as const

export const GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS = [
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
  "lower_third",
] as const

export const GROWTH_MEDIA_VIDEO_OVERLAY_FONT_WEIGHTS = [
  "normal",
  "medium",
  "semibold",
  "bold",
] as const

export const GROWTH_MEDIA_VIDEO_OVERLAY_ALIGNMENTS = ["left", "center", "right"] as const

export type GrowthMediaVideoOverlayType = (typeof GROWTH_MEDIA_VIDEO_OVERLAY_TYPES)[number]
export type GrowthMediaVideoOverlayPosition = (typeof GROWTH_MEDIA_VIDEO_OVERLAY_POSITIONS)[number]
export type GrowthMediaVideoOverlayFontWeight = (typeof GROWTH_MEDIA_VIDEO_OVERLAY_FONT_WEIGHTS)[number]
export type GrowthMediaVideoOverlayAlignment = (typeof GROWTH_MEDIA_VIDEO_OVERLAY_ALIGNMENTS)[number]

export type GrowthMediaVideoOverlayTiming = {
  startSeconds: number | null
  endSeconds: number | null
  alwaysVisible: boolean
  fadeInMs: number
  fadeOutMs: number
}

export type GrowthMediaVideoOverlayStyle = {
  fontSize: number | null
  fontWeight: GrowthMediaVideoOverlayFontWeight | null
  alignment: GrowthMediaVideoOverlayAlignment | null
  textColor: string | null
  backgroundColor: string | null
  backgroundOpacity: number | null
  borderRadius: number | null
  padding: number | null
  maxWidth: number | null
}

export type GrowthMediaVideoOverlayItem = {
  id: string
  type: GrowthMediaVideoOverlayType
  enabled: boolean
  textTemplate: string
  mergeFieldsUsed: string[]
  position: GrowthMediaVideoOverlayPosition
  timing: GrowthMediaVideoOverlayTiming
  style: GrowthMediaVideoOverlayStyle
  zIndex: number
  fallbackText: string
}

export type GrowthMediaVideoOverlaySpec = {
  overlays: GrowthMediaVideoOverlayItem[]
  qaMarker?: string
}

export type GrowthMediaVideoOverlayResolvedItem = GrowthMediaVideoOverlayItem & {
  resolvedText: string
  usedFallback: boolean
}

export const GROWTH_MEDIA_VIDEO_OVERLAY_SAFETY_FLAGS = {
  no_rendered_video: true,
  no_media_personalization: true,
  no_playback: true,
  no_ai_generation: true,
} as const

export const GROWTH_MEDIA_VIDEO_OVERLAY_STANDARD_MERGE_KEYS = [
  "lead.contact_name",
  "lead.company_name",
  "company.name",
  "prospect.name",
  "prospect.company",
  "booking.link",
  "sender.name",
  "sender.company",
] as const
