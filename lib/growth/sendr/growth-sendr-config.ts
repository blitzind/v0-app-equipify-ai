/** GS-SENDR-2A — Personalized Media Runtime config (client-safe). */

export const GROWTH_SENDR_QA_MARKER = "growth-personalized-media-runtime-gs-sendr-2a-v1" as const

export const GROWTH_SENDR_WORKSPACE_QA_MARKER =
  "growth-sendr-operator-workspace-gs-sendr-2b-v1" as const

export const GROWTH_SENDR_PUBLIC_QA_MARKER =
  "growth-sendr-public-runtime-gs-sendr-2c-v1" as const

export const GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER =
  "growth-sendr-sequence-bridge-gs-sendr-2d-v1" as const

export const GROWTH_SENDR_INTELLIGENCE_QA_MARKER =
  "growth-sendr-intelligence-gs-sendr-2e-v1" as const

export const GROWTH_SENDR_LAUNCH_QA_MARKER =
  "growth-sendr-launch-gs-sendr-3a-v1" as const

export const GROWTH_SENDR_SEQUENCE_BRIDGE_SCHEMA_MIGRATION =
  "20270901190000_growth_sendr_sequence_bridge_gs_sendr_2d.sql" as const

export const GROWTH_SENDR_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270901200000_growth_sendr_intelligence_gs_sendr_2e.sql" as const

export const GROWTH_SENDR_LAUNCH_SCHEMA_MIGRATION =
  "20270902120000_growth_sendr_launch_gs_sendr_3a.sql" as const

/** Merge token resolved at sequence send time. */
export const GROWTH_SENDR_PAGE_URL_MERGE_TOKEN = "{{sendr_page_url}}" as const
export const GROWTH_SENDR_PAGE_URL_VARIABLE_KEY = "sendr.page_url" as const

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
  MAX_SENDR_PAGE_ATTACHMENTS_PER_SEQUENCE: 10,
  MAX_SENDR_SEQUENCE_LINKS_PER_PAGE: 25,
  MAX_SENDR_URL_RESOLUTIONS_PER_BATCH: 500,
  MAX_SENDR_TIMELINE_EVENTS_PER_SESSION: 20,
  MAX_SENDR_INTENT_RECALCULATIONS_PER_DAY: 10_000,
  MAX_SENDR_RECOMMENDATIONS_PER_DAY: 5_000,
  MAX_SENDR_TIMELINE_WRITES_PER_DAY: 10_000,
  MAX_SENDR_LAUNCH_RUNS_PER_DAY: 500,
  MAX_SENDR_PREVIEW_MEMBERS: 10_000,
  MAX_SENDR_LAUNCH_PREVIEW_CHUNK: 500,
  MAX_SENDR_LAUNCH_ENROLLMENT_CHUNK: 100,
  MAX_SENDR_LAUNCH_STEP_DURATION_MS: 15_000,
} as const

/** Deterministic intent signal weights — no AI, sum capped at 100. */
export const GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS = {
  page_view: 5,
  video_start: 10,
  video_complete: 20,
  cta_click: 15,
  calendar_open: 20,
  booking_started: 25,
  booking_completed: 40,
  repeat_visit: 15,
} as const

export const GROWTH_SENDR_INTENT_LEVEL_THRESHOLDS = {
  medium: 34,
  high: 67,
} as const

export type GrowthSendrIntentLevel = "low" | "medium" | "high"

export const GROWTH_SENDR_RESOURCE_ESTIMATES = {
  mediaAssetCreate: { maxReadsPerRun: 3, maxWritesPerRun: 3, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  landingPagePublish: { maxReadsPerRun: 120, maxWritesPerRun: 105, maxSideEffectsPerRun: 0, maxRunsPerDay: 200 },
  engagementEventBatch: { maxReadsPerRun: 2, maxWritesPerRun: 500, maxSideEffectsPerRun: 0, maxRunsPerDay: 10_000 },
  videoMetadataRegister: { maxReadsPerRun: 2, maxWritesPerRun: 2, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  publicPageLoad: { maxReadsPerRun: 4, maxWritesPerRun: 0, maxSideEffectsPerRun: 0, maxRunsPerDay: 50_000 },
  publicEventIngest: { maxReadsPerRun: 8, maxWritesPerRun: 6, maxSideEffectsPerRun: 1, maxRunsPerDay: 10_000 },
  sequenceLinkAttach: { maxReadsPerRun: 5, maxWritesPerRun: 2, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  urlResolution: { maxReadsPerRun: 3, maxWritesPerRun: 0, maxSideEffectsPerRun: 0, maxRunsPerDay: 50_000 },
  intentRecalculation: { maxReadsPerRun: 25, maxWritesPerRun: 2, maxSideEffectsPerRun: 1, maxRunsPerDay: 10_000 },
  recommendationGeneration: { maxReadsPerRun: 5, maxWritesPerRun: 0, maxSideEffectsPerRun: 0, maxRunsPerDay: 5_000 },
  timelineIntelligenceUpdate: { maxReadsPerRun: 3, maxWritesPerRun: 1, maxSideEffectsPerRun: 0, maxRunsPerDay: 10_000 },
  launchPreview: { maxReadsPerRun: 120, maxWritesPerRun: 0, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
  launchRun: { maxReadsPerRun: 250, maxWritesPerRun: 120, maxSideEffectsPerRun: 0, maxRunsPerDay: 500 },
} as const

export const GROWTH_SENDR_LAUNCH_KILL_SWITCHES = [
  "sendr_launch_enabled",
  "sendr_launch_preview_enabled",
] as const

export type GrowthSendrLaunchKillSwitchKey = (typeof GROWTH_SENDR_LAUNCH_KILL_SWITCHES)[number]

export const GROWTH_SENDR_SEQUENCE_BRIDGE_KILL_SWITCHES = [
  "sendr_sequence_bridge_enabled",
  "sendr_timeline_enabled",
] as const

export const GROWTH_SENDR_INTELLIGENCE_KILL_SWITCHES = [
  "sendr_intelligence_enabled",
  "sendr_recommendations_enabled",
] as const

export type GrowthSendrIntelligenceKillSwitchKey =
  (typeof GROWTH_SENDR_INTELLIGENCE_KILL_SWITCHES)[number]

export type GrowthSendrSequenceBridgeKillSwitchKey =
  (typeof GROWTH_SENDR_SEQUENCE_BRIDGE_KILL_SWITCHES)[number]

export const GROWTH_SENDR_KILL_SWITCHES = [
  "media_assets_enabled",
  "landing_pages_enabled",
  "video_tracking_enabled",
  "agent_tracking_enabled",
  "booking_tracking_enabled",
] as const

export type GrowthSendrKillSwitchKey = (typeof GROWTH_SENDR_KILL_SWITCHES)[number]
