/** Growth Engine A1 — Video Recording Studio foundation types (client-safe). */

export const GROWTH_VIDEO_FOUNDATION_QA_MARKER = "growth-video-foundation-a1-v1" as const

export const GROWTH_VIDEO_FOUNDATION_CONFIRM = "RUN_GROWTH_VIDEO_FOUNDATION_CERTIFICATION" as const

export const GROWTH_VIDEO_FOUNDATION_MIGRATION =
  "20270828130000_growth_engine_video_recording_studio_foundation.sql" as const

export const GROWTH_VIDEO_ASSETS_UPLOAD_MIGRATION =
  "20270828140000_growth_engine_video_assets_upload_a2.sql" as const

export const GROWTH_VIDEO_ASSETS_QA_MARKER = "growth-video-assets-a2-v1" as const

export const GROWTH_VIDEO_ASSETS_CONFIRM = "RUN_GROWTH_VIDEO_ASSETS_CERTIFICATION" as const

export const GROWTH_VIDEO_PAGES_MIGRATION =
  "20270828150000_growth_engine_personalized_video_pages_a3.sql" as const

export const GROWTH_VIDEO_PAGES_QA_MARKER = "growth-video-pages-a3-v1" as const

export const GROWTH_VIDEO_PAGES_CONFIRM = "RUN_GROWTH_VIDEO_PAGES_CERTIFICATION" as const

export const GROWTH_VIDEO_ANALYTICS_MIGRATION =
  "20270828160000_growth_engine_video_analytics_a4.sql" as const

export const GROWTH_VIDEO_ANALYTICS_QA_MARKER = "growth-video-analytics-a4-v1" as const

export const GROWTH_VIDEO_ANALYTICS_CONFIRM = "RUN_GROWTH_VIDEO_ANALYTICS_CERTIFICATION" as const

export const GROWTH_VIDEO_PERSONALIZATION_QA_MARKER = "growth-video-personalization-b1-v1" as const

export const GROWTH_VIDEO_PERSONALIZATION_CONFIRM = "RUN_GROWTH_VIDEO_PERSONALIZATION_CERTIFICATION" as const

export const GROWTH_VIDEO_THUMBNAILS_MIGRATION =
  "20270828170000_growth_engine_video_thumbnails_b3.sql" as const

export const GROWTH_VIDEO_THUMBNAILS_QA_MARKER = "growth-video-thumbnails-b3-v1" as const

export const GROWTH_VIDEO_THUMBNAILS_CONFIRM = "RUN_GROWTH_VIDEO_THUMBNAILS_CERTIFICATION" as const

export const GROWTH_VIDEO_THUMBNAIL_TYPES = ["prospect", "company", "cta", "open_graph"] as const

export type GrowthVideoThumbnailType = (typeof GROWTH_VIDEO_THUMBNAIL_TYPES)[number]

export const GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS = [
  "video_viewed",
  "video_high_intent",
  "video_cta_clicked",
  "video_calendar_clicked",
  "video_return_visitor",
] as const

export type GrowthVideoAiEngagementSignal = (typeof GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS)[number]

export type GrowthVideoEngagementSummary = {
  id: string
  organizationId: string
  videoAssetId: string
  videoPageId: string
  visitorIdentifier: string | null
  sessionId: string
  totalViews: number
  totalWatchSeconds: number
  highestPercentWatched: number
  totalCtaClicks: number
  totalCalendarClicks: number
  firstViewedAt: string | null
  lastViewedAt: string | null
  engagementScore: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthVideoAnalyticsOverview = {
  totalViews: number
  uniqueVisitors: number
  averageWatchPercent: number | null
  ctaClicks: number
  calendarClicks: number
  meetingsBooked: number | null
  averageEngagementScore: number | null
}

export type GrowthVideoAnalyticsTimeSeriesPoint = {
  date: string
  views: number
  uniqueSessions: number
}

export type GrowthVideoAnalyticsDistributionBucket = {
  label: string
  count: number
}

export type GrowthVideoAnalyticsTopItem = {
  id: string
  title: string
  views: number
  engagementScore: number | null
}

export type GrowthVideoEngagementTimelineStep = {
  id: string
  eventType: string
  label: string
  occurredAt: string
  sessionId: string | null
  videoPageId: string
  videoAssetId: string
  metadata: Record<string, unknown>
}

export type GrowthVideoVisitorProfile = {
  visitorIdentifier: string
  sessionCount: number
  totalViews: number
  highestEngagementScore: number
  lastViewedAt: string | null
  aiSignals: Record<GrowthVideoAiEngagementSignal, boolean>
}

export const GROWTH_VIDEOS_STORAGE_BUCKET = "growth-videos" as const

export const GROWTH_VIDEO_MAX_UPLOAD_BYTES = 262_144_000 as const

export const GROWTH_VIDEO_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const

export type GrowthVideoAllowedMimeType = (typeof GROWTH_VIDEO_ALLOWED_MIME_TYPES)[number]

export const GROWTH_VIDEO_UPLOAD_STATUSES = [
  "pending",
  "uploading",
  "uploaded",
  "failed",
] as const

export type GrowthVideoUploadStatus = (typeof GROWTH_VIDEO_UPLOAD_STATUSES)[number]

export const GROWTH_VIDEO_FEATURE_FLAG = "growth_video_workspace_enabled" as const

export const GROWTH_VIDEO_ASSET_STATUSES = [
  "draft",
  "processing",
  "ready",
  "archived",
  "failed",
] as const

export type GrowthVideoAssetStatus = (typeof GROWTH_VIDEO_ASSET_STATUSES)[number]

export const GROWTH_VIDEO_SOURCE_TYPES = [
  "webcam",
  "screen",
  "screen_webcam",
  "upload",
  "ai_generated",
] as const

export type GrowthVideoSourceType = (typeof GROWTH_VIDEO_SOURCE_TYPES)[number]

export const GROWTH_VIDEO_TRANSCRIPT_STATUSES = [
  "not_started",
  "pending",
  "processing",
  "ready",
  "failed",
] as const

export type GrowthVideoTranscriptStatus = (typeof GROWTH_VIDEO_TRANSCRIPT_STATUSES)[number]

export const GROWTH_VIDEO_CAPTIONS_STATUSES = [
  "not_started",
  "pending",
  "processing",
  "ready",
  "failed",
] as const

export type GrowthVideoCaptionsStatus = (typeof GROWTH_VIDEO_CAPTIONS_STATUSES)[number]

export const GROWTH_VIDEO_STORAGE_PROVIDERS = [
  "supabase_storage",
  "s3",
  "cloudflare_r2",
  "custom",
] as const

export type GrowthVideoStorageProvider = (typeof GROWTH_VIDEO_STORAGE_PROVIDERS)[number]

export type GrowthVideoAssetMetadata = Record<string, unknown>

export type GrowthVideoAsset = {
  id: string
  organizationId: string
  createdBy: string | null
  title: string
  description: string | null
  status: GrowthVideoAssetStatus
  sourceType: GrowthVideoSourceType
  durationSeconds: number | null
  storageProvider: GrowthVideoStorageProvider | null
  storagePath: string | null
  thumbnailPath: string | null
  transcriptStatus: GrowthVideoTranscriptStatus
  captionsStatus: GrowthVideoCaptionsStatus
  originalFilename: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  uploadStatus: GrowthVideoUploadStatus
  processingError: string | null
  metadata: GrowthVideoAssetMetadata
  createdAt: string
  updatedAt: string
}

export type GrowthVideoAssetListResponse = {
  ok: boolean
  items: GrowthVideoAsset[]
  qa_marker: string
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type GrowthVideoAssetResponse = {
  ok: boolean
  asset: GrowthVideoAsset
  playbackUrl?: string | null
  playbackExpiresAt?: string | null
  qa_marker: string
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export type GrowthVideoTemplate = {
  id: string
  organizationId: string
  name: string
  description: string | null
  thumbnailPath: string | null
  configuration: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthVideoView = {
  id: string
  organizationId: string
  videoAssetId: string
  visitorIdentifier: string | null
  sessionId: string | null
  watchedSeconds: number
  percentWatched: number
  ctaClicked: boolean
  meetingBooked: boolean
  metadata: Record<string, unknown>
  createdAt: string
}

export const GROWTH_VIDEO_PAGE_STATUSES = ["draft", "published", "archived"] as const

export type GrowthVideoPageStatus = (typeof GROWTH_VIDEO_PAGE_STATUSES)[number]

export const GROWTH_VIDEO_PAGE_EVENT_TYPES = [
  "page_view",
  "video_play",
  "video_progress",
  "video_complete",
  "cta_click",
  "calendar_click",
] as const

export type GrowthVideoPageEventType = (typeof GROWTH_VIDEO_PAGE_EVENT_TYPES)[number]

export type GrowthVideoPageBranding = {
  logoUrl?: string | null
  primaryColor?: string | null
  buttonLabelOverride?: string | null
}

export type GrowthVideoPagePersonalization = {
  variables?: Record<string, string>
  mergeFields?: string[]
  previewContext?: Record<string, string>
}

export type GrowthVideoSequenceHookMetadata = {
  sequence_candidate_id?: string | null
  enrollment_candidate_id?: string | null
  company_candidate_id?: string | null
  person_candidate_id?: string | null
  lead_id?: string | null
}

export type GrowthVideoMergeContextResult = {
  variables: Record<string, string>
  aliases: Record<string, string>
  missing: string[]
  sourcesUsed: string[]
}

export type GrowthVideoPreviewFormInput = {
  firstName?: string
  lastName?: string
  company?: string
  title?: string
  industry?: string
  city?: string
  state?: string
  email?: string
  country?: string
  painPoint?: string
  senderName?: string
  senderEmail?: string
  bookingLink?: string
  calendarUrl?: string
  ctaUrl?: string
}

export type GrowthVideoRenderedPreview = {
  title: string
  description: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  buttonLabelOverride: string | null
}

export type GrowthVideoAiPayload = {
  resolved_variables: Record<string, string>
  aliases_used: Record<string, string>
  missing_variables: string[]
  sources_used: string[]
  personalization_score: number
  rendered_preview: GrowthVideoRenderedPreview
  sequence_hooks?: GrowthVideoSequenceHookMetadata
}

export type GrowthVideoThumbnailPreviewFormInput = {
  firstName?: string
  lastName?: string
  company?: string
  industry?: string
  title?: string
  companyLogoUrl?: string
  ctaLabel?: string
}

export type GrowthVideoThumbnailLayout = {
  headline: string
  subheadline: string
  badge: string
  ctaText: string
}

export type GrowthVideoThumbnailRenderResult = {
  type: GrowthVideoThumbnailType
  layout: GrowthVideoThumbnailLayout
  mergeValues: Record<string, string>
  svg: string
  width: number
  height: number
}

export type GrowthVideoThumbnailMetadata = {
  type: GrowthVideoThumbnailType
  thumbnailStoragePath: string | null
  ogStoragePath: string | null
  thumbnailSignedUrl?: string | null
  ogSignedUrl?: string | null
  mergeValues: Record<string, string>
  layout: GrowthVideoThumbnailLayout
  generatedAt: string | null
  videoAssetId: string
  videoPageId: string
  hooks?: GrowthVideoThumbnailHookMetadata
}

export type GrowthVideoThumbnailHookMetadata = {
  lead_id?: string | null
  company_candidate_id?: string | null
  person_candidate_id?: string | null
  video_page_id?: string | null
  video_asset_id?: string | null
}

export type GrowthVideoThumbnailAiPayload = {
  thumbnail_variables: Record<string, string>
  resolved_values: Record<string, string>
  rendered_thumbnail_url: string | null
  rendered_og_image_url: string | null
  sources_used: string[]
  thumbnail_score: number
}

export type GrowthVideoPage = {
  id: string
  organizationId: string
  videoAssetId: string
  createdBy: string | null
  slug: string
  title: string
  description: string | null
  status: GrowthVideoPageStatus
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  branding: GrowthVideoPageBranding
  personalization: GrowthVideoPagePersonalization
  metadata: Record<string, unknown>
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthVideoPageEvent = {
  id: string
  organizationId: string
  videoPageId: string
  videoAssetId: string
  eventType: GrowthVideoPageEventType
  visitorIdentifier: string | null
  sessionId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthVideoPublicPage = {
  slug: string
  title: string
  description: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  calendarUrl: string | null
  branding: GrowthVideoPageBranding
  playbackUrl: string | null
  playbackExpiresAt: string | null
  videoTitle: string | null
  /** B1 — merge context applied server-side; raw templates never exposed when personalized. */
  personalizationApplied?: boolean
  missingVariables?: string[]
  thumbnailUrl?: string | null
  ogImageUrl?: string | null
  qa_marker:
    | typeof GROWTH_VIDEO_PAGES_QA_MARKER
    | typeof GROWTH_VIDEO_PERSONALIZATION_QA_MARKER
    | typeof GROWTH_VIDEO_THUMBNAILS_QA_MARKER
}

export type GrowthVideoWorkspaceRouteId =
  | "library"
  | "pages"
  | "record"
  | "templates"
  | "analytics"
  | "settings"

export const GROWTH_VIDEO_WORKSPACE_ROUTE_IDS: GrowthVideoWorkspaceRouteId[] = [
  "library",
  "pages",
  "record",
  "templates",
  "analytics",
  "settings",
]
