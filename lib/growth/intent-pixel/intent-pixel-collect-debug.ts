/** Structured collect rejection diagnostics (growth-intent-pixel-422-debug-v1). */

import type { GrowthIntentPixelCollectPayload } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { GrowthIntentPixelSite } from "@/lib/growth/intent-pixel/intent-pixel-types"

export const GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER =
  "growth-intent-pixel-422-debug-v1" as const

export const GROWTH_INTENT_PIXEL_COLLECT_REJECTION_CODES = [
  "schema_not_ready",
  "unknown_site_key",
  "domain_not_allowed",
  "tracking_disabled",
  "consent_denied",
  "consent_unknown",
  "validation_error",
] as const

export type GrowthIntentPixelCollectRejectionCode =
  (typeof GROWTH_INTENT_PIXEL_COLLECT_REJECTION_CODES)[number]

export type GrowthIntentPixelCollectRejectionDiagnostics = {
  qa_marker: typeof GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER
  rejection_code: GrowthIntentPixelCollectRejectionCode
  reason: string
  site_key: string | null
  event_type: string | null
  consent_status: string | null
  page_url: string | null
  page_hostname: string | null
  domain_allowed: boolean | null
  domain_allowlist: string[]
  tracking_enabled: boolean | null
  consent_required: boolean | null
  allow_anonymous_pageviews: boolean | null
  tracking_mode_resolved: string | null
}

function pageHostname(pageUrl: string | undefined): string | null {
  const url = typeof pageUrl === "string" ? pageUrl.trim() : ""
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function classifyCollectRejectionReason(reason: string): GrowthIntentPixelCollectRejectionCode {
  const r = reason.toLowerCase()
  if (r.includes("schema") || r.includes("migration")) return "schema_not_ready"
  if (r.includes("unknown intent pixel site")) return "unknown_site_key"
  if (r.includes("domain allowlist") || r.includes("hostname not on")) return "domain_not_allowed"
  if (r.includes("tracking is disabled")) return "tracking_disabled"
  if (r.includes("consent denied")) return "consent_denied"
  if (r.includes("consent unknown") || r.includes("awaiting visitor consent")) return "consent_unknown"
  return "validation_error"
}

export function buildCollectRejectionDiagnostics(input: {
  reason: string
  payload?: GrowthIntentPixelCollectPayload | null
  site?: GrowthIntentPixelSite | null
  domainAllowed?: boolean | null
  trackingModeResolved?: string | null
}): GrowthIntentPixelCollectRejectionDiagnostics {
  const rejection_code = classifyCollectRejectionReason(input.reason)
  const host = pageHostname(input.payload?.page_url)

  return {
    qa_marker: GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER,
    rejection_code,
    reason: input.reason,
    site_key: input.payload?.site_key ?? null,
    event_type: input.payload?.event_type ?? null,
    consent_status: input.payload?.consent_status ?? null,
    page_url: input.payload?.page_url ?? null,
    page_hostname: host,
    domain_allowed: input.domainAllowed ?? null,
    domain_allowlist: input.site?.domain_allowlist ?? [],
    tracking_enabled: input.site?.tracking_enabled ?? null,
    consent_required: input.site?.consent_required ?? null,
    allow_anonymous_pageviews: input.site?.allow_anonymous_pageviews ?? null,
    tracking_mode_resolved: input.trackingModeResolved ?? null,
  }
}

export function logIntentPixelCollectRejection(
  diagnostics: GrowthIntentPixelCollectRejectionDiagnostics,
): void {
  console.warn(
    "[growth-intent-pixel-collect-rejected]",
    JSON.stringify({
      rejection_code: diagnostics.rejection_code,
      reason: diagnostics.reason,
      site_key: diagnostics.site_key,
      event_type: diagnostics.event_type,
      consent_status: diagnostics.consent_status,
      page_hostname: diagnostics.page_hostname,
      domain_allowed: diagnostics.domain_allowed,
      tracking_mode_resolved: diagnostics.tracking_mode_resolved,
      qa_marker: diagnostics.qa_marker,
    }),
  )
}
