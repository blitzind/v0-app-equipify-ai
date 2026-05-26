/** Growth Engine — Live Visitor Monitor types (Prompt 25). Client-safe. */

import type { GrowthIntentPixelConsentStatus } from "@/lib/growth/intent-pixel/intent-pixel-types"

export const GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER = "growth-live-visitor-monitor-v1" as const

export const GROWTH_PIXEL_VERIFICATION_STATUSES = [
  "healthy",
  "no_traffic",
  "domain_mismatch",
  "consent_blocked",
  "schema_missing",
] as const

export type GrowthPixelVerificationStatus =
  (typeof GROWTH_PIXEL_VERIFICATION_STATUSES)[number]

export type GrowthPixelHealthTone = "healthy" | "attention" | "problem"

export type GrowthIntentPixelInstallVerification = {
  pixel_status: GrowthPixelVerificationStatus
  health_tone: GrowthPixelHealthTone
  status_label: string
  schema_ready: boolean
  tracking_enabled: boolean
  pixel_script_configured: boolean
  events_received_recently: boolean
  allowed_domain_match: boolean
  recent_event_count_15m: number
  domain_mismatch_count_1h: number
  consent_distribution: Record<GrowthIntentPixelConsentStatus, number>
  checks: Array<{
    id: string
    label: string
    passed: boolean
    tone: GrowthPixelHealthTone
    detail: string
  }>
}

export type GrowthLiveVisitorRow = {
  session_id: string
  visitor_key: string
  display_label: string
  visitor_type: "anonymous" | "identified"
  session_duration_ms: number
  session_duration_label: string
  page_count: number
  current_page: string
  referrer: string | null
  utm_source: string
  utm_medium: string
  utm_campaign: string
  search_intent_detected: string | null
  company_match_confidence: number | null
  buying_stage_candidate: string | null
  consent_status: GrowthIntentPixelConsentStatus
  high_intent: boolean
  returning_session: boolean
  last_activity_at: string
}

export type GrowthVisitorTimelineEntry = {
  id: string
  session_id: string
  captured_at: string
  display_label: string
  active_duration_label: string
  page_path: string
  page_title: string
  kind: "pageview" | "conversion"
  conversion_label?: string
  visitor_type: "anonymous" | "identified"
  search_intent_label: string | null
  buying_stage_candidate: string | null
  timeline_badges: string[]
}

export type GrowthHighIntentQueueItem = {
  session_id: string
  visitor_key: string
  display_label: string
  visitor_type: "anonymous" | "identified"
  intent_score: number
  intent_grade: string
  buying_stage_candidate: string | null
  high_intent: boolean
  returning_account: boolean
  pricing_viewed: boolean
  signals: string[]
  lead_engine_eligible: boolean
  last_activity_at: string
}

export type GrowthLiveVisitorMonitorSnapshot = {
  qa_marker: typeof GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER
  site_key: string
  generated_at: string
  install_verification: GrowthIntentPixelInstallVerification
  live_visitors: GrowthLiveVisitorRow[]
  visitor_timeline: GrowthVisitorTimelineEntry[]
  high_intent_queue: GrowthHighIntentQueueItem[]
  privacy_note: string
}
