/** Growth Engine — Intent Pixel admin UI + platform APIs (Prompt 13). */

import type { GrowthIntentPixelConsentStatus } from "@/lib/growth/intent-pixel/intent-pixel-types"

export const GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER = "growth-intent-pixel-admin-v1" as const

export const GROWTH_INTENT_PIXEL_TRACKING_MODES = [
  "consent_gated",
  "always_on",
  "disabled",
] as const

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
  script_snippet: string
  pixel_script_url: string
  created_at: string
  updated_at: string
}

export type GrowthIntentPixelAdminDiagnostics = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER
  schema_ready: boolean
  site_key: string | null
  session_count_24h: number
  pageview_count_24h: number
  conversion_count_24h: number
  identified_contact_count_24h: number
  consent_denied_sessions_24h: number
  consent_unknown_sessions_24h: number
  consent_granted_sessions_24h: number
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
  tracking_mode: "full" | "essential_only" | "rejected"
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
