/** Growth Engine — Intent Pixel admin UI + platform APIs (Prompt 13). */

import type { GrowthIntentPixelConsentStatus } from "@/lib/growth/intent-pixel/intent-pixel-types"

export const GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER = "growth-intent-pixel-admin-v1" as const

export { GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER } from "@/lib/growth/intent-pixel/intent-consent-manager-types"
export { GROWTH_INTENT_CONSENT_CATEGORIES_QA_MARKER } from "@/lib/growth/intent-pixel/intent-consent-categories"

/** Live activation — admin handoff + schema readiness (Prompt 23). */
export const GROWTH_INTENT_PIXEL_LIVE_QA_MARKER = "growth-intent-pixel-live-v1" as const

export { GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"

export const GROWTH_INTENT_PIXEL_TRACKING_MODES = [
  "anonymous_pageviews",
  "consent_gated",
  "always_on",
  "disabled",
] as const

export { GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER } from "@/lib/growth/intent-pixel/intent-pixel-collect-debug"

export type GrowthIntentPixelTrackingMode =
  (typeof GROWTH_INTENT_PIXEL_TRACKING_MODES)[number]

export const GROWTH_INTENT_PIXEL_INSTALL_STATUSES = [
  "schema_missing",
  "offline",
  "idle",
  "receiving",
] as const

export type GrowthIntentPixelInstallStatus =
  (typeof GROWTH_INTENT_PIXEL_INSTALL_STATUSES)[number]

export type GrowthIntentPixelAdminSite = {
  id: string
  site_key: string
  site_name: string
  domain_allowlist: string[]
  tracking_mode: GrowthIntentPixelTrackingMode
  tracking_enabled: boolean
  consent_required: boolean
  allow_anonymous_pageviews: boolean
  script_snippet: string
  pixel_script_url: string
  created_at: string
  updated_at: string
}

export type GrowthIntentPixelProcessRecentResult = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_LIVE_QA_MARKER
  site_key: string
  sessions_scanned: number
  bridged_count: number
  eligible_count: number
  ingested_count: number
  duplicate_count: number
  skipped_count: number
  inbox_ids: string[]
  errors: string[]
}

export type GrowthIntentPixelAdminDiagnostics = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER
  schema_ready: boolean
  schema_migration: string
  site_key: string | null
  session_count_24h: number
  pageview_count_24h: number
  conversion_count_24h: number
  identified_contact_count_24h: number
  consent_denied_sessions_24h: number
  consent_unknown_sessions_24h: number
  consent_granted_sessions_24h: number
  consent_acceptance_pct: number | null
  tracking_coverage_pct: number | null
  anonymous_sessions_blocked_24h: number
  high_intent_sessions_blocked_by_consent_24h: number
  consent_breakdown: {
    granted: number
    denied: number
    unknown: number
  }
  tracking_visibility_impacted: boolean
  personalization_coverage_pct: number | null
  marketing_attribution_coverage_pct: number | null
  segmented_visitors_pct: number | null
  campaign_attributed_sessions_pct: number | null
  install_status: GrowthIntentPixelInstallStatus
  last_event_at: string | null
  privacy_note: string
}

export type GrowthIntentPixelStreamEventKind = "pageview" | "conversion"

export type GrowthIntentPixelAdminStreamEvent = {
  kind: GrowthIntentPixelStreamEventKind
  id: string
  captured_at: string
  visitor_key: string
  session_key: string
  session_id: string
  consent_status: GrowthIntentPixelConsentStatus
  tracking_mode: "full" | "essential_only" | "anonymous" | "rejected"
  visitor_type: "anonymous" | "identified"
  page_path: string
  page_url: string
  referrer: string | null
  utm_source: string
  utm_medium: string
  utm_campaign: string
  conversion_type?: string
  conversion_label?: string
}

export type GrowthIntentPixelAdminRecentEvents = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER
  site_key: string
  events: GrowthIntentPixelAdminStreamEvent[]
}

export {
  GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
  GROWTH_PIXEL_VERIFICATION_STATUSES,
  type GrowthPixelVerificationStatus,
  type GrowthPixelHealthTone,
  type GrowthIntentPixelInstallVerification,
  type GrowthLiveVisitorRow,
  type GrowthVisitorTimelineEntry,
  type GrowthHighIntentQueueItem,
  type GrowthLiveVisitorMonitorSnapshot,
} from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
