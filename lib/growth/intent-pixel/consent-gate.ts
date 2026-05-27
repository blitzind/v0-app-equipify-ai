import {
  EXPLICIT_CAPTURE_CONVERSION_TYPES,
} from "@/lib/growth/intent-pixel/intent-consent-manager-types"
import {
  allowsAnalyticsCategory,
  allowsMarketingCategory,
  allowsPersonalizationCategory,
  resolveEffectiveConsentCategories,
  type IntentConsentCategories,
} from "@/lib/growth/intent-pixel/intent-consent-categories"
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

export function resolveConsentCategories(input: {
  consent_status: GrowthIntentPixelConsentStatus
  consent_categories?: Partial<IntentConsentCategories> | null
}): IntentConsentCategories {
  return resolveEffectiveConsentCategories(input)
}

export function allowsBehavioralTracking(
  consentStatus: GrowthIntentPixelConsentStatus,
  trackingMode: GrowthIntentPixelTrackingMode,
  categories?: IntentConsentCategories | null,
): boolean {
  const resolved = categories ?? resolveEffectiveConsentCategories({ consent_status: consentStatus })
  return (
    trackingMode === "full" &&
    allowsAnalyticsCategory(resolved) &&
    (consentStatus === "granted" || consentStatus === "not_required")
  )
}

export function allowsIntentScoring(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  const resolved = categories ?? resolveEffectiveConsentCategories({ consent_status: consentStatus })
  return (
    allowsAnalyticsCategory(resolved) &&
    (consentStatus === "granted" || consentStatus === "not_required")
  )
}

export function allowsSearchIntentSignals(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  return allowsIntentScoring(consentStatus, categories)
}

export function allowsBuyingStageInference(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  return allowsIntentScoring(consentStatus, categories)
}

export function allowsSessionScoring(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  return allowsIntentScoring(consentStatus, categories)
}

export function allowsPersonalizationTracking(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  const resolved = categories ?? resolveEffectiveConsentCategories({ consent_status: consentStatus })
  return (
    allowsPersonalizationCategory(resolved) &&
    (consentStatus === "granted" || consentStatus === "not_required")
  )
}

export function allowsMarketingAttribution(
  consentStatus: GrowthIntentPixelConsentStatus,
  categories?: IntentConsentCategories | null,
): boolean {
  const resolved = categories ?? resolveEffectiveConsentCategories({ consent_status: consentStatus })
  return (
    allowsMarketingCategory(resolved) &&
    (consentStatus === "granted" || consentStatus === "not_required")
  )
}

export function resolveTrackingMode(
  site: GrowthIntentPixelSite,
  consentStatus: GrowthIntentPixelConsentStatus,
  eventType: GrowthIntentPixelEventType,
  conversionType?: string | null,
  categories?: Partial<IntentConsentCategories> | null,
): { mode: GrowthIntentPixelTrackingMode; accepted: boolean; reason: string } {
  const resolvedCategories = resolveEffectiveConsentCategories({
    consent_status: consentStatus,
    consent_categories: categories,
  })

  if (!site.tracking_enabled) {
    return { mode: "rejected", accepted: false, reason: "Site tracking is disabled." }
  }

  if (!site.consent_required) {
    return { mode: "full", accepted: true, reason: "Consent not required for this site." }
  }

  if (
    (consentStatus === "granted" || consentStatus === "not_required") &&
    allowsAnalyticsCategory(resolvedCategories)
  ) {
    return { mode: "full", accepted: true, reason: "Analytics consent granted." }
  }

  if (ESSENTIAL_EVENTS.has(eventType)) {
    return {
      mode: "essential_only",
      accepted: true,
      reason: "Consent preference update stored.",
    }
  }

  if (eventType === "conversion" && isExplicitCaptureConversion(conversionType)) {
    return {
      mode: "essential_only",
      accepted: true,
      reason: "Explicit capture event permitted while analytics consent denied.",
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

  if (consentStatus === "denied" || !allowsAnalyticsCategory(resolvedCategories)) {
    return {
      mode: "rejected",
      accepted: false,
      reason: "Analytics consent denied — anonymous session and behavioral tracking blocked.",
    }
  }

  return {
    mode: "rejected",
    accepted: false,
    reason: "Consent unknown — awaiting visitor consent before analytics.",
  }
}
