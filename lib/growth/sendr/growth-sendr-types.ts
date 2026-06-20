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
  rowsReadToday: number
  rowsWrittenToday: number
  failuresToday: number
  throttlesToday: number
}
