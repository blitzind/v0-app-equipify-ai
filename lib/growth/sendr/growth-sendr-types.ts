import type {
  GrowthSendrEngagementEventType,
  GrowthSendrLandingPageSectionType,
  GrowthSendrLandingPageStatus,
  GrowthSendrMediaAssetType,
} from "@/lib/growth/sendr/growth-sendr-config"

export type GrowthSendrMediaAsset = {
  id: string
  organizationId: string
  ownerUserId: string
  assetType: GrowthSendrMediaAssetType
  name: string
  slug: string | null
  status: "draft" | "published" | "archived"
  publishedVersionId: string | null
  legacyMediaAssetId: string | null
  legacySharePageId: string | null
  legacyVideoAssetId: string | null
  metadata: Record<string, unknown>
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSendrMediaAssetVersion = {
  id: string
  mediaAssetId: string
  organizationId: string
  versionNumber: number
  status: "draft" | "published" | "archived"
  isImmutable: boolean
  storageMetadata: Record<string, unknown>
  publishedAt: string | null
  publishedBy: string | null
  createdAt: string
}

export type GrowthSendrLandingPage = {
  id: string
  organizationId: string
  ownerUserId: string
  mediaAssetId: string | null
  leadId: string | null
  title: string
  status: GrowthSendrLandingPageStatus
  variableMap: Record<string, string>
  mobileMetadata: Record<string, unknown>
  legacySharePageId: string | null
  slug: string | null
  publishedSlug: string | null
  publishedVersion: number | null
  publishedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSendrLandingPageSection = {
  id: string
  landingPageId: string
  organizationId: string
  sectionType: GrowthSendrLandingPageSectionType
  sortOrder: number
  content: Record<string, unknown>
  variablePlaceholders: string[]
  createdAt: string
}

export type GrowthSendrVideoAsset = {
  id: string
  organizationId: string
  ownerUserId: string
  mediaAssetId: string | null
  sourceUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  sizeBytes: number | null
  posterUrl: string | null
  transcriptStatus: "none" | "pending" | "ready" | "failed"
  captionsStatus: "none" | "pending" | "ready" | "failed"
  legacyVideoAssetId: string | null
  deletedAt: string | null
  createdAt: string
}

export type GrowthSendrConversationAgent = {
  id: string
  organizationId: string
  ownerUserId: string
  mediaAssetId: string | null
  name: string
  provider: string
  published: boolean
  publishedVersionId: string | null
  bookingEnabled: boolean
  deletedAt: string | null
  createdAt: string
}

export type GrowthSendrBookingAsset = {
  id: string
  organizationId: string
  ownerUserId: string
  mediaAssetId: string | null
  meetingLink: string | null
  meetingType: string | null
  durationMinutes: number | null
  timezone: string | null
  calendarProvider: "google" | "outlook" | "manual" | null
  legacyBookingPageId: string | null
  deletedAt: string | null
  createdAt: string
}

export type GrowthSendrEngagementEventInput = {
  sessionId: string
  eventType: GrowthSendrEngagementEventType
  landingPageId?: string | null
  videoAssetId?: string | null
  bookingAssetId?: string | null
  conversationAgentId?: string | null
  eventValue?: Record<string, unknown>
}

export type GrowthSendrLandingPagePublication = {
  id: string
  landingPageId: string
  organizationId: string
  publishedAt: string
  publishedBy: string | null
  createdAt: string
  versionNumber: number | null
  publishedSlug: string | null
}

/** Public visitor payload — no internal UUIDs exposed. */
export type GrowthSendrPublicPageSection = {
  type: GrowthSendrLandingPageSectionType
  sortOrder: number
  content: Record<string, unknown>
}

export type GrowthSendrPublicPagePayload = {
  title: string
  publishedVersion: number
  publishedAt: string
  sections: GrowthSendrPublicPageSection[]
  video: {
    sourceUrl: string | null
    posterUrl: string | null
    durationSeconds: number | null
  } | null
  booking: {
    meetingLink: string | null
    meetingType: string | null
    durationMinutes: number | null
    timezone: string | null
  } | null
}

export type GrowthSendrWorkspaceSummary = {
  recentPages: GrowthSendrLandingPage[]
  recentMediaAssets: GrowthSendrMediaAsset[]
  pagesPublishedToday: number
  pagesCreatedToday: number
  assetsCreatedToday: number
  engagementEventsToday: number
  failuresToday: number
  throttlesToday: number
  schemaReady: boolean
  metrics?: GrowthSendrWorkspaceMetrics
  intelligence?: GrowthSendrWorkspaceIntelligence
}

export type GrowthSendrPersonalizationPreviewResult = {
  resolved: Record<string, string>
  fallbacks: Record<string, string>
  missing: string[]
  renderedSamples: Record<string, string>
}

export type GrowthSendrObservabilitySnapshot = {
  schemaReady: boolean
  assetsCreatedToday: number
  pagesPublishedToday: number
  publicPageViewsToday: number
  videoEventsToday: number
  bookingsToday: number
  ctaClicksToday: number
  agentEventsToday: number
  pagesLinkedToday: number
  urlResolutionsToday: number
  timelineEventsToday: number
  intentCalculationsToday: number
  recommendationsGeneratedToday: number
  timelineWritesToday: number
  rowsReadToday: number
  rowsWrittenToday: number
  failuresToday: number
  throttlesToday: number
}

export type GrowthSendrSequencePageLink = {
  id: string
  organizationId: string
  landingPageId: string
  sequencePatternId: string
  sequencePatternStepId: string | null
  enrollmentRunId: string | null
  linkStatus: "draft" | "approved" | "removed"
  metadata: Record<string, unknown>
  attachedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSendrAssetPickerItem = {
  id: string
  assetKind: "media" | "video" | "booking" | "landing_page"
  name: string
  subtitle: string | null
  status: string
  previewUrl: string | null
  metadata: Record<string, unknown>
}

export type GrowthSendrWorkspaceMetrics = {
  publishedPagesTotal: number
  viewsToday: number
  ctaClicksToday: number
  attachedToSequencesCount: number
  activeSequenceCount: number
  topPages: Array<{
    landingPageId: string
    title: string
    slug: string | null
    views: number
    bookings: number
    ctaClicks: number
    ctaRate: number
  }>
}

export type GrowthSendrPageEngagementIntelligence = {
  landingPageId: string
  title: string
  slug: string | null
  pageViews: number
  uniqueVisitors: number
  repeatVisitors: number
  videoStarts: number
  videoCompletes: number
  ctaClicks: number
  calendarOpens: number
  bookingStarts: number
  bookingCompletes: number
  viewRate: number
  ctaRate: number
  bookingRate: number
  completionRate: number
  repeatEngagementRate: number
}

export type GrowthSendrLeadIntelligence = {
  leadId: string
  contactName: string | null
  companyName: string | null
  landingPageId: string | null
  landingPageTitle: string | null
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  lastSendrActivityAt: string | null
  sendrEngagementCount: number
  recommendations: GrowthSendrRecommendation[]
}

export type GrowthSendrRecommendation = {
  id: string
  priority: number
  title: string
  reason: string
  actionKind: "call" | "email" | "meeting" | "reminder" | "archive" | "page_review"
}

export type GrowthSendrWorkspaceIntelligence = {
  topPerformingPages: GrowthSendrPageEngagementIntelligence[]
  highIntentProspects: GrowthSendrLeadIntelligence[]
  pagesNeedingAttention: Array<
    GrowthSendrPageEngagementIntelligence & { attentionReason: string }
  >
}

export type GrowthSendrLeadIntelligenceMetadata = {
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  lastSendrActivityAt: string | null
  sendrEngagementCount: number
  lastUpdatedAt: string
  qa_marker: string
}
