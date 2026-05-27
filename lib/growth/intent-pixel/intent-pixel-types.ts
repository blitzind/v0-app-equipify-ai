/** Growth Engine — Real-Time Intent Pixel types (Prompt 12). Client-safe where noted. */

export const GROWTH_INTENT_PIXEL_QA_MARKER = "growth-intent-pixel-v1" as const

export const GROWTH_INTENT_PIXEL_CONSENT_STATUSES = [
  "unknown",
  "denied",
  "granted",
  "not_required",
] as const

export type GrowthIntentPixelConsentStatus =
  (typeof GROWTH_INTENT_PIXEL_CONSENT_STATUSES)[number]

export const GROWTH_INTENT_PIXEL_EVENT_TYPES = [
  "pageview",
  "page_exit",
  "heartbeat",
  "conversion",
  "consent_update",
] as const

export type GrowthIntentPixelEventType = (typeof GROWTH_INTENT_PIXEL_EVENT_TYPES)[number]

/** Sources allowed to attach PII — never inferred from anonymous pageviews. */
export const GROWTH_INTENT_PIXEL_PII_CAPTURE_SOURCES = [
  "form",
  "booking",
  "chat",
  "login",
  "lead_capture",
  "enrichment",
] as const

export type GrowthIntentPixelPiiCaptureSource =
  (typeof GROWTH_INTENT_PIXEL_PII_CAPTURE_SOURCES)[number]

export const GROWTH_INTENT_PIXEL_CONVERSION_TYPES = [
  "form_submit",
  "booking",
  "chat",
  "login",
  "lead_capture",
  "custom",
] as const

export type GrowthIntentPixelConversionType =
  (typeof GROWTH_INTENT_PIXEL_CONVERSION_TYPES)[number]

export type GrowthIntentPixelUtmAttribution = {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
}

export type GrowthIntentPixelDeviceMetadata = {
  user_agent: string
  language: string
  timezone: string
  screen_width: number | null
  screen_height: number | null
  platform: string
}

export type GrowthIntentPixelBrowserMetadata = {
  referrer: string
  landing_url: string
  page_url: string
  consent_categories?: {
    analytics: boolean
    personalization: boolean
    marketing: boolean
  }
  personalization_segment?: {
    industry_affinity: string | null
    content_affinity: string | null
    returning_visitor: boolean
    visit_count: number
    last_industry_slug: string | null
    recommended_cta: string | null
    recommended_case_study_slug: string | null
  }
}

export type GrowthIntentPixelSubmittedIdentity = {
  email?: string
  phone?: string
  full_name?: string
  linkedin_url?: string
  company_name?: string
}

export type GrowthIntentPixelCollectPayload = {
  site_key: string
  event_type: GrowthIntentPixelEventType
  visitor_key?: string
  session_key?: string
  consent_status?: GrowthIntentPixelConsentStatus
  consent_categories?: Partial<{
    analytics: boolean
    personalization: boolean
    marketing: boolean
  }>
  personalization_segment?: GrowthIntentPixelBrowserMetadata["personalization_segment"]
  page_url?: string
  page_path?: string
  page_title?: string
  referrer?: string
  utm?: Partial<GrowthIntentPixelUtmAttribution>
  duration_ms?: number
  device?: Partial<GrowthIntentPixelDeviceMetadata>
  browser?: Partial<GrowthIntentPixelBrowserMetadata>
  conversion_type?: GrowthIntentPixelConversionType
  conversion_label?: string
  conversion_metadata?: Record<string, unknown>
  /** Only honored when conversion_type maps to an explicit capture source. */
  submitted_identity?: GrowthIntentPixelSubmittedIdentity
}

export type GrowthIntentPixelSite = {
  id: string
  site_key: string
  site_name: string
  domain_allowlist: string[]
  tracking_enabled: boolean
  consent_required: boolean
  /** When true, anonymous pageviews persist while consent is unknown (no PII). */
  allow_anonymous_pageviews: boolean
}

export type GrowthIntentPixelVisitorSession = {
  id: string
  site_id: string
  visitor_key: string
  session_key: string
  is_identified: boolean
  consent_status: GrowthIntentPixelConsentStatus
  first_touch_utm: GrowthIntentPixelUtmAttribution
  last_touch_utm: GrowthIntentPixelUtmAttribution
  first_referrer: string | null
  last_referrer: string | null
  first_landing_url: string | null
  last_page_url: string | null
  device_metadata: GrowthIntentPixelDeviceMetadata
  browser_metadata: GrowthIntentPixelBrowserMetadata
  pageview_count: number
  total_time_on_site_ms: number
  started_at: string
  last_activity_at: string
  ended_at: string | null
}

export type GrowthIntentPixelPageviewEvent = {
  id: string
  session_id: string
  page_url: string
  page_path: string
  page_title: string
  referrer: string | null
  utm: GrowthIntentPixelUtmAttribution
  duration_ms: number
  captured_at: string
}

export type GrowthIntentPixelConversionEvent = {
  id: string
  session_id: string
  conversion_type: GrowthIntentPixelConversionType
  conversion_label: string
  page_url: string
  metadata: Record<string, unknown>
  captured_at: string
}

export type GrowthIntentPixelIdentifiedContact = {
  id: string
  session_id: string
  capture_source: GrowthIntentPixelPiiCaptureSource
  email: string | null
  phone: string | null
  full_name: string | null
  linkedin_url: string | null
  company_name: string | null
  captured_at: string
}

export type GrowthIntentPixelVisitHistory = {
  visitor_key: string
  session_count: number
  total_pageviews: number
  total_time_on_site_ms: number
  first_seen_at: string | null
  last_seen_at: string | null
  sessions: Array<{
    session_key: string
    started_at: string
    last_activity_at: string
    pageview_count: number
    total_time_on_site_ms: number
    is_identified: boolean
    consent_status: GrowthIntentPixelConsentStatus
    first_touch_utm: GrowthIntentPixelUtmAttribution
    last_touch_utm: GrowthIntentPixelUtmAttribution
    pageviews: GrowthIntentPixelPageviewEvent[]
    conversions: GrowthIntentPixelConversionEvent[]
  }>
}

export type GrowthIntentPixelCaptureResult = {
  ok: boolean
  qa_marker: typeof GROWTH_INTENT_PIXEL_QA_MARKER
  accepted: boolean
  reason: string
  visitor_key: string | null
  session_key: string | null
  session_id: string | null
  consent_status: GrowthIntentPixelConsentStatus
  tracking_mode: "full" | "essential_only" | "anonymous" | "rejected"
  rejection_code?: string
}

export type GrowthIntentPixelDiagnostics = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_QA_MARKER
  schema_ready: boolean
  site_key: string | null
  session_count_24h: number
  pageview_count_24h: number
  conversion_count_24h: number
  identified_contact_count_24h: number
  privacy_note: string
}
