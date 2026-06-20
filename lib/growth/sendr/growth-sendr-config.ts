/** GS-SENDR-2A — Personalized Media Runtime config (client-safe). */

export const GROWTH_SENDR_QA_MARKER = "growth-personalized-media-runtime-gs-sendr-2a-v1" as const

export const GROWTH_SENDR_WORKSPACE_QA_MARKER =
  "growth-sendr-operator-workspace-gs-sendr-2b-v1" as const

export const GROWTH_SENDR_PUBLIC_QA_MARKER =
  "growth-sendr-public-runtime-gs-sendr-2c-v1" as const

export const GROWTH_SENDR_SCHEMA_MIGRATION =
  "20270901170000_growth_personalized_media_runtime_gs_sendr_2a.sql" as const

export const GROWTH_SENDR_PUBLIC_SCHEMA_MIGRATION =
  "20270901180000_growth_sendr_public_runtime_gs_sendr_2c.sql" as const

export const GROWTH_SENDR_TIMELINE_EVENT_TYPES = [
  "landing_page_viewed",
  "video_started",
  "video_completed",
  "cta_clicked",
  "booking_started",
  "booking_completed",
] as const

export type GrowthSendrTimelineEventType = (typeof GROWTH_SENDR_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_SENDR_MEDIA_ASSET_TYPES = [
  "page",
  "video",
  "avatar_video",
  "voice",
  "calendar",
  "cta",
  "conversation_agent",
] as const

export type GrowthSendrMediaAssetType = (typeof GROWTH_SENDR_MEDIA_ASSET_TYPES)[number]

export const GROWTH_SENDR_LANDING_PAGE_STATUSES = ["draft", "published", "archived"] as const

export type GrowthSendrLandingPageStatus = (typeof GROWTH_SENDR_LANDING_PAGE_STATUSES)[number]

export const GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES = [
  "hero",
  "text",
  "video",
  "calendar",
  "cta",
  "faq",
  "custom_html",
] as const

export type GrowthSendrLandingPageSectionType =
  (typeof GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES)[number]

export const GROWTH_SENDR_PERSONALIZATION_VARIABLES = [
  "first_name",
  "last_name",
  "company_name",
  "industry",
  "job_title",
  "city",
  "state",
  "owner_name",
  "meeting_link",
] as const

export type GrowthSendrPersonalizationVariable =
  (typeof GROWTH_SENDR_PERSONALIZATION_VARIABLES)[number]

export const GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES = [
  "page_view",
  "scroll",
  "video_start",
  "video_progress",
  "video_complete",
  "cta_click",
  "calendar_open",
  "booking_started",
  "booking_completed",
  "agent_opened",
  "agent_question",
  "agent_completed",
] as const

export type GrowthSendrEngagementEventType = (typeof GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES)[number]

/** Hard caps — every SENDR path must answer guardrail questions before shipping. */
export const GROWTH_SENDR_LIMITS = {
  MAX_MEDIA_ASSETS_PER_ORG: 5_000,
  MAX_PAGE_SECTIONS: 100,
  MAX_PAGE_VIEWS_PER_SESSION: 100,
  MAX_VIDEO_EVENTS_PER_SESSION: 200,
  MAX_AGENT_EVENTS_PER_SESSION: 200,
  MAX_BOOKINGS_PER_DAY: 500,
  MAX_MEDIA_EVENT_BATCH: 500,
  MAX_MEDIA_ASSET_VERSIONS_PER_ASSET: 50,
  MAX_LANDING_PAGE_PUBLICATIONS_PER_PAGE: 100,
} as const

export const GROWTH_SENDR_RESOURCE_ESTIMATES = {
  mediaAssetCreate: { maxReadsPerRun: 3, maxWritesPerRun: 3, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  landingPagePublish: { maxReadsPerRun: 120, maxWritesPerRun: 105, maxSideEffectsPerRun: 0, maxRunsPerDay: 200 },
  engagementEventBatch: { maxReadsPerRun: 2, maxWritesPerRun: 500, maxSideEffectsPerRun: 0, maxRunsPerDay: 10_000 },
  videoMetadataRegister: { maxReadsPerRun: 2, maxWritesPerRun: 2, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  publicPageLoad: { maxReadsPerRun: 4, maxWritesPerRun: 0, maxSideEffectsPerRun: 0, maxRunsPerDay: 50_000 },
  publicEventIngest: { maxReadsPerRun: 8, maxWritesPerRun: 6, maxSideEffectsPerRun: 1, maxRunsPerDay: 10_000 },
} as const

export const GROWTH_SENDR_KILL_SWITCHES = [
  "media_assets_enabled",
  "landing_pages_enabled",
  "video_tracking_enabled",
  "agent_tracking_enabled",
  "booking_tracking_enabled",
] as const

export type GrowthSendrKillSwitchKey = (typeof GROWTH_SENDR_KILL_SWITCHES)[number]
