import {
  EXPLICIT_CAPTURE_CONVERSION_TYPES,
} from "@/lib/growth/intent-pixel/intent-consent-manager-types"
import {
  GROWTH_INTENT_PIXEL_CONSENT_STATUSES,
  type GrowthIntentPixelConsentStatus,
  type GrowthIntentPixelEventType,
  type GrowthIntentPixelSite,
} from "@/lib/growth/intent-pixel/intent-pixel-types"

const ESSENTIAL_EVENTS = new Set<GrowthIntentPixelEventType>(["consent_update"])

const ANONYMOUS_PAGE_EVENTS = new Set<GrowthIntentPixelEventType>([
  "pageview",
  "page_exit",
  "heartbeat",
])

export type GrowthIntentPixelTrackingMode =
  | "full"
  | "essential_only"
  | "anonymous"
  | "rejected"

export function normalizeConsentStatus(value: unknown): GrowthIntentPixelConsentStatus {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  return GROWTH_INTENT_PIXEL_CONSENT_STATUSES.includes(raw as GrowthIntentPixelConsentStatus)
    ? (raw as GrowthIntentPixelConsentStatus)
    : "unknown"
}

export function isExplicitCaptureConversion(conversionType?: string | null): boolean {
  const raw = typeof conversionType === "string" ? conversionType.trim().toLowerCase() : ""
  return EXPLICIT_CAPTURE_CONVERSION_TYPES.includes(raw as (typeof EXPLICIT_CAPTURE_CONVERSION_TYPES)[number])
}

export function allowsBehavioralTracking(
  consentStatus: GrowthIntentPixelConsentStatus,
  trackingMode: GrowthIntentPixelTrackingMode,
): boolean {
  return (
    trackingMode === "full" &&
    (consentStatus === "granted" || consentStatus === "not_required")
  )
}

export function allowsIntentScoring(consentStatus: GrowthIntentPixelConsentStatus): boolean {
  return consentStatus === "granted" || consentStatus === "not_required"
}

export function allowsSearchIntentSignals(consentStatus: GrowthIntentPixelConsentStatus): boolean {
  return allowsIntentScoring(consentStatus)
}

export function allowsBuyingStageInference(consentStatus: GrowthIntentPixelConsentStatus): boolean {
  return allowsIntentScoring(consentStatus)
}

export function allowsSessionScoring(consentStatus: GrowthIntentPixelConsentStatus): boolean {
  return allowsIntentScoring(consentStatus)
}

export function resolveTrackingMode(
  site: GrowthIntentPixelSite,
  consentStatus: GrowthIntentPixelConsentStatus,
  eventType: GrowthIntentPixelEventType,
  conversionType?: string | null,
): { mode: GrowthIntentPixelTrackingMode; accepted: boolean; reason: string } {
  if (!site.tracking_enabled) {
    return { mode: "rejected", accepted: false, reason: "Site tracking is disabled." }
  }

  if (!site.consent_required) {
    return { mode: "full", accepted: true, reason: "Consent not required for this site." }
  }

  if (consentStatus === "granted" || consentStatus === "not_required") {
    return { mode: "full", accepted: true, reason: "Consent granted." }
  }

  if (consentStatus === "denied") {
    if (ESSENTIAL_EVENTS.has(eventType)) {
      return {
        mode: "essential_only",
        accepted: true,
        reason: "Consent denied — only consent preference stored.",
      }
    }
    if (eventType === "conversion" && isExplicitCaptureConversion(conversionType)) {
      return {
        mode: "essential_only",
        accepted: true,
        reason: "Explicit capture event permitted while analytics consent denied.",
      }
    }
    return {
      mode: "rejected",
      accepted: false,
      reason: "Consent denied — anonymous session and behavioral tracking blocked.",
    }
  }

  if (
    site.allow_anonymous_pageviews &&
    consentStatus === "unknown" &&
    ANONYMOUS_PAGE_EVENTS.has(eventType)
  ) {
    return {
      mode: "essential_only",
      accepted: true,
      reason:
        "Operational pageview only — no behavioral profiling or intent scoring until consent is granted.",
    }
  }

  if (ESSENTIAL_EVENTS.has(eventType)) {
    return {
      mode: "essential_only",
      accepted: true,
      reason: "Consent unknown — consent preference update only.",
    }
  }

  return {
    mode: "rejected",
    accepted: false,
    reason: "Consent unknown — awaiting visitor consent before analytics.",
  }
}
