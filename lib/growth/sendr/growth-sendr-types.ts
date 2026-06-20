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

export type GrowthSendrPublicPagePersonalizationMeta = {
  applied: boolean
  mode: "anonymous" | "lead" | "token"
  fallbackReason?: "invalid_lead" | "invalid_token" | "expired_token" | "org_mismatch" | "lead_not_found" | null
  missingVariables?: string[]
  qaMarker?: string
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
  personalization?: GrowthSendrPublicPagePersonalizationMeta
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
  launchesToday: number
  launchPreviewsToday: number
  launchFailuresToday: number
  launchThrottlesToday: number
  membersEnrolledViaLaunchesToday: number
  analyticsLoadsToday: number
  dashboardRefreshesToday: number
  analyticsFailuresToday: number
  analyticsThrottlesToday: number
  activityLoadsToday: number
  feedRefreshesToday: number
  activityFailuresToday: number
  activityThrottlesToday: number
  rowsReadToday: number
  rowsWrittenToday: number
  failuresToday: number
  throttlesToday: number
}

export type GrowthSendrLaunchRunStatus =
  | "pending"
  | "previewing"
  | "ready_to_enroll"
  | "enrolling"
  | "completed"
  | "failed"
  | "cancelled"

export type GrowthSendrLaunchNextAction = "continue" | "done" | "cancelled"

export type GrowthSendrLaunchRun = {
  id: string
  organizationId: string
  audienceId: string
  sequencePatternId: string
  landingPageId: string
  previewId: string | null
  enrollmentRunId: string | null
  sequenceLinkId: string | null
  status: GrowthSendrLaunchRunStatus
  requestedCount: number
  enrolledCount: number
  processedCount: number
  remainingCount: number
  cursor: Record<string, unknown>
  lastStep: string | null
  lastError: string | null
  startedAt: string
  completedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthSendrLaunchPreviewResult = {
  memberCount: number
  eligibleCount: number
  alreadyEnrolledCount: number
  missingLeadCount: number
  suppressedCount: number
  blockedCount: number
  sendrPageUrl: string | null
  sampleVariables: Record<string, string>
  estimatedReads: number
  estimatedWrites: number
}

export type GrowthSendrLaunchWorkspaceSummary = {
  audiences: Array<{
    id: string
    name: string
    memberCount: number | null
    lastSnapshotId: string | null
  }>
  publishedPages: Array<{
    id: string
    title: string
    slug: string | null
    publishedAt: string | null
  }>
  sequencePatterns: Array<{
    id: string
    name: string
    channelMix: string | null
  }>
  recentLaunches: GrowthSendrLaunchRun[]
}

export type GrowthSendrLaunchRunProgress = {
  launchRunId: string
  enrollmentRunId: string | null
  sequenceLinkId: string | null
  previewId: string | null
  status: GrowthSendrLaunchRunStatus
  requestedCount: number
  enrolledCount: number
  processedCount: number
  remainingCount: number
  nextAction: GrowthSendrLaunchNextAction
  hasMore: boolean
  rowsRead: number
  rowsWritten: number
  error: string | null
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

export type GrowthSendrAnalyticsDateRangePreset = "today" | "last_7_days" | "last_30_days" | "custom"

export type GrowthSendrAnalyticsDateRange = {
  preset: GrowthSendrAnalyticsDateRangePreset
  startAt: string
  endAt: string
  label: string
}

export type GrowthSendrAnalyticsOverview = {
  pagesPublished: number
  launches: number
  publicViews: number
  ctaClicks: number
  bookingsStarted: number
  bookingsCompleted: number
  highIntentProspects: number
}

export type GrowthSendrAnalyticsFunnelStep = {
  key: string
  label: string
  count: number
  conversionPercent: number | null
  dropOffPercent: number | null
}

export type GrowthSendrAnalyticsFunnel = {
  steps: GrowthSendrAnalyticsFunnelStep[]
  dateRange: GrowthSendrAnalyticsDateRange
}

export type GrowthSendrAnalyticsPageRow = {
  landingPageId: string
  title: string
  slug: string | null
  status: string
  views: number
  ctaClicks: number
  bookings: number
  conversionPercent: number
  lastActivityAt: string | null
}

export type GrowthSendrAnalyticsProspectRow = {
  leadId: string
  contactName: string | null
  companyName: string | null
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  lastActivityAt: string | null
  sendrPageViewed: string | null
  sendrPageId: string | null
  recommendation: string | null
}

export type GrowthSendrAnalyticsLaunchRow = {
  launchRunId: string
  audienceName: string | null
  sequenceName: string | null
  sendrPageTitle: string | null
  sendrPageId: string
  enrolled: number
  views: number
  ctaClicks: number
  bookings: number
  status: GrowthSendrLaunchRunStatus
  startedAt: string
}

export type GrowthSendrAnalyticsAttentionRow = {
  landingPageId: string
  title: string
  slug: string | null
  recommendation: string
  rule: "no_views_7d" | "views_no_cta" | "cta_no_bookings"
}

export type GrowthSendrAnalyticsWorkspaceSummary = {
  overview: GrowthSendrAnalyticsOverview
  topPages: GrowthSendrAnalyticsPageRow[]
  highIntentProspects: GrowthSendrAnalyticsProspectRow[]
  launchesNeedingAttention: GrowthSendrAnalyticsLaunchRow[]
  pagesNeedingAttention: GrowthSendrAnalyticsAttentionRow[]
  dateRange: GrowthSendrAnalyticsDateRange
}

export type GrowthSendrActivityEventLabel =
  | "Page Viewed"
  | "Video Started"
  | "Video Completed"
  | "CTA Clicked"
  | "Booking Started"
  | "Booking Completed"
  | "Launch Sent"

export type GrowthSendrActivityFeedRow = {
  id: string
  occurredAt: string
  eventType: string
  eventLabel: GrowthSendrActivityEventLabel
  leadId: string | null
  leadName: string | null
  companyName: string | null
  landingPageId: string | null
  landingPageTitle: string | null
  sessionId: string | null
  intentScore: number | null
  metadata: Record<string, unknown>
}

export type GrowthSendrActivityHotProspect = {
  leadId: string
  leadName: string | null
  companyName: string | null
  intentScore: number
  intentLevel: "low" | "medium" | "high"
  lastActivityAt: string | null
  pageViews: number
  videoCompletionPercent: number
  ctaClicks: number
  bookingStatus: "none" | "started" | "completed"
  recommendations: string[]
  landingPageId: string | null
  landingPageTitle: string | null
}

export type GrowthSendrActivityTimelineEvent = {
  id: string
  occurredAt: string
  eventType: string
  eventLabel: GrowthSendrActivityEventLabel
  title: string
  summary: string | null
  landingPageId: string | null
  landingPageTitle: string | null
  landingPageSlug: string | null
  sessionId: string | null
  metadata: Record<string, unknown>
}

export type GrowthSendrActivityLeadTimeline = {
  leadId: string
  leadName: string | null
  companyName: string | null
  intentScore: number | null
  events: GrowthSendrActivityTimelineEvent[]
}

export type GrowthSendrActivitySummary = {
  totalEvents: number
  uniqueLeads: number
  pageViews: number
  videoCompletes: number
  ctaClicks: number
  bookingsCompleted: number
  hotProspects: number
}

export type GrowthSendrActivityWorkspaceSummary = {
  summary: GrowthSendrActivitySummary
  recentActivity: GrowthSendrActivityFeedRow[]
  hotProspects: GrowthSendrActivityHotProspect[]
  dateRange: GrowthSendrAnalyticsDateRange
}
