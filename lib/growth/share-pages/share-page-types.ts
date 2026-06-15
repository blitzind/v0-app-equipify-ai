/** Growth Engine SR-2B-1 — Personalized Share Pages types (client-safe). */

export const GROWTH_SHARE_PAGES_QA_MARKER = "share-pages-sr2-v1" as const

export const GROWTH_SHARE_PAGES_MIGRATION =
  "20270826120000_growth_engine_share_pages_foundation.sql" as const

export const GROWTH_SHARE_PAGES_CONFIRM = "RUN_GROWTH_SHARE_PAGES_CERTIFICATION" as const

export const GROWTH_SHARE_PAGE_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "expired",
  "revoked",
  "archived",
] as const

export type GrowthSharePageStatus = (typeof GROWTH_SHARE_PAGE_STATUSES)[number]

export const GROWTH_SHARE_PAGE_SOURCE_CHANNELS = [
  "email",
  "sms",
  "voice",
  "call",
  "linkedin",
  "sequence",
  "manual",
  "other",
] as const

export type GrowthSharePageSourceChannel = (typeof GROWTH_SHARE_PAGE_SOURCE_CHANNELS)[number]

export const GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES = ["none", "image", "video"] as const

export type GrowthSharePageHeroMediaType = (typeof GROWTH_SHARE_PAGE_HERO_MEDIA_TYPES)[number]

export const GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES = ["system", "light", "dark"] as const

export type GrowthSharePagePublicThemeMode = (typeof GROWTH_SHARE_PAGE_PUBLIC_THEME_MODES)[number]

export const GROWTH_SHARE_PAGE_EVENT_TYPES = [
  "SHARE_PAGE_VIEWED",
  "SHARE_PAGE_SESSION_STARTED",
  "SHARE_PAGE_SCROLL_25",
  "SHARE_PAGE_SCROLL_50",
  "SHARE_PAGE_SCROLL_75",
  "SHARE_PAGE_SCROLL_100",
  "SHARE_PAGE_CTA_CLICKED",
  "SHARE_PAGE_BOOKING_STARTED",
  "SHARE_PAGE_BOOKING_COMPLETED",
  "SHARE_PAGE_RESOURCE_OPENED",
] as const

export type GrowthSharePageEventType = (typeof GROWTH_SHARE_PAGE_EVENT_TYPES)[number]

export type GrowthSharePageTheme = {
  brandColor: string
  accentColor: string
  logoUrl: string | null
  heroImageUrl: string | null
  publicThemeMode: GrowthSharePagePublicThemeMode
  footerNote: string | null
}

export type GrowthSharePageCTA = {
  id: string
  label: string
  kind: "primary" | "secondary" | "link"
  action: "book_meeting" | "open_url" | "download_resource" | "reply_email"
  destinationUrl: string | null
  resourceId: string | null
  trackingKey: string
}

export type GrowthSharePageResource = {
  id: string
  title: string
  description: string | null
  kind: "pdf" | "link" | "case_study" | "one_pager"
  url: string
  thumbnailUrl: string | null
}

export type GrowthSharePagePersonalizationContext = {
  prospectName: string
  companyName: string
  headline: string
  personalizedMessage: string
  whyReachingOut: string
  companyObservations: string[]
  researchSummary: string | null
  accountPlaybookSummary: string | null
  suggestedCta: GrowthSharePageCTA | null
  nextBestMessage: string | null
  bookingLink: string | null
  resources: GrowthSharePageResource[]
  sourcesUsed: string[]
  evidenceCoverageScore: number
  researchConfidence: number | null
  generatedAt: string
}

export type GrowthSharePageEngagementSummary = {
  viewCount: number
  uniqueSessionCount: number
  ctaClickCount: number
  bookingStartedCount: number
  bookingCompletedCount: number
  resourceOpenCount: number
  maxScrollDepthPct: number
  avgDurationMs: number
  lastActivityAt: string | null
}

export type GrowthSharePage = {
  id: string
  organizationId: string
  leadId: string
  companyId: string | null
  campaignId: string | null
  enrollmentId: string | null
  sequenceStepId: string | null
  sequenceExecutionJobId: string | null
  sourceChannel: GrowthSharePageSourceChannel
  status: GrowthSharePageStatus
  tokenPrefix: string
  publishedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  archivedAt: string | null
  firstViewedAt: string | null
  lastViewedAt: string | null
  maxViews: number | null
  engagementSummary: GrowthSharePageEngagementSummary
  personalizationSnapshot: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion: number
  sourcesUsed: string[]
  evidenceCoverageScore: number | null
  theme: GrowthSharePageTheme
  headline: string
  subheadline: string | null
  heroMessage: string
  whyReachingOut: string | null
  companyObservations: string[]
  ctaConfig: GrowthSharePageCTA[]
  resources: GrowthSharePageResource[]
  bookingPageId: string | null
  heroMediaType: GrowthSharePageHeroMediaType
  heroMediaUrl: string | null
  heroMediaThumbnailUrl: string | null
  voiceAssetId: string | null
  videoAssetId: string | null
  createdBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  requiresHumanReview: true
  createdAt: string
  updatedAt: string
}

export type GrowthSharePageView = {
  id: string
  sharePageId: string
  leadId: string
  sessionKey: string
  visitorFingerprintHash: string | null
  startedAt: string
  lastActivityAt: string
  endedAt: string | null
  durationMs: number
  maxScrollDepthPct: number
  pageUrl: string
  referrer: string | null
  utm: Record<string, string>
  deviceMetadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthSharePageEvent = {
  id: string
  sharePageId: string
  sharePageViewId: string | null
  leadId: string
  eventType: GrowthSharePageEventType
  eventLabel: string
  metadata: Record<string, unknown>
  occurredAt: string
  createdAt: string
}

export type GrowthSharePageCreateInput = {
  organizationId: string
  leadId: string
  companyId?: string | null
  campaignId?: string | null
  enrollmentId?: string | null
  sequenceStepId?: string | null
  sequenceExecutionJobId?: string | null
  sourceChannel?: GrowthSharePageSourceChannel
  status?: Extract<GrowthSharePageStatus, "draft" | "pending_review">
  expiresAt?: string | null
  maxViews?: number | null
  personalizationSnapshot?: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion?: number
  sourcesUsed?: string[]
  evidenceCoverageScore?: number | null
  theme?: Partial<GrowthSharePageTheme>
  headline?: string
  subheadline?: string | null
  heroMessage?: string
  whyReachingOut?: string | null
  companyObservations?: string[]
  ctaConfig?: GrowthSharePageCTA[]
  resources?: GrowthSharePageResource[]
  bookingPageId?: string | null
  heroMediaType?: GrowthSharePageHeroMediaType
  heroMediaUrl?: string | null
  heroMediaThumbnailUrl?: string | null
  voiceAssetId?: string | null
  videoAssetId?: string | null
  createdBy?: string | null
}

export type GrowthSharePageCreateResult = {
  page: GrowthSharePage
  publicToken: string
  previewToken: string
}

export type GrowthSharePageUpdateInput = {
  status?: Extract<GrowthSharePageStatus, "draft" | "pending_review">
  expiresAt?: string | null
  maxViews?: number | null
  personalizationSnapshot?: GrowthSharePagePersonalizationContext | Record<string, unknown>
  personalizationContextVersion?: number
  sourcesUsed?: string[]
  evidenceCoverageScore?: number | null
  theme?: Partial<GrowthSharePageTheme>
  headline?: string
  subheadline?: string | null
  heroMessage?: string
  whyReachingOut?: string | null
  companyObservations?: string[]
  ctaConfig?: GrowthSharePageCTA[]
  resources?: GrowthSharePageResource[]
  bookingPageId?: string | null
  heroMediaType?: GrowthSharePageHeroMediaType
  heroMediaUrl?: string | null
  heroMediaThumbnailUrl?: string | null
  voiceAssetId?: string | null
  videoAssetId?: string | null
}

export type GrowthSharePageAnalyticsSummary = {
  sharePageId: string
  leadId: string
  status: GrowthSharePageStatus
  viewCount: number
  uniqueSessionCount: number
  eventCounts: Partial<Record<GrowthSharePageEventType, number>>
  engagementSummary: GrowthSharePageEngagementSummary
  firstViewedAt: string | null
  lastViewedAt: string | null
  lastEventAt: string | null
}

export const GROWTH_SHARE_PAGE_STATUS_LABELS: Record<GrowthSharePageStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  expired: "Expired",
  revoked: "Revoked",
  archived: "Archived",
}

export const DEFAULT_GROWTH_SHARE_PAGE_THEME: GrowthSharePageTheme = {
  brandColor: "#059669",
  accentColor: "#047857",
  logoUrl: null,
  heroImageUrl: null,
  publicThemeMode: "system",
  footerNote: null,
}

export const EMPTY_GROWTH_SHARE_PAGE_ENGAGEMENT_SUMMARY: GrowthSharePageEngagementSummary = {
  viewCount: 0,
  uniqueSessionCount: 0,
  ctaClickCount: 0,
  bookingStartedCount: 0,
  bookingCompletedCount: 0,
  resourceOpenCount: 0,
  maxScrollDepthPct: 0,
  avgDurationMs: 0,
  lastActivityAt: null,
}
