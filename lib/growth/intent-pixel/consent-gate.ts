import {
  GROWTH_INTENT_PIXEL_CONSENT_STATUSES,
  type GrowthIntentPixelConsentStatus,
  type GrowthIntentPixelEventType,
  type GrowthIntentPixelSite,
} from "@/lib/growth/intent-pixel/intent-pixel-types"

const ESSENTIAL_EVENTS = new Set<GrowthIntentPixelEventType>(["consent_update"])

export type GrowthIntentPixelTrackingMode = "full" | "essential_only" | "rejected"

export function normalizeConsentStatus(value: unknown): GrowthIntentPixelConsentStatus {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  return GROWTH_INTENT_PIXEL_CONSENT_STATUSES.includes(raw as GrowthIntentPixelConsentStatus)
    ? (raw as GrowthIntentPixelConsentStatus)
    : "unknown"
}

export function resolveTrackingMode(
  site: GrowthIntentPixelSite,
  consentStatus: GrowthIntentPixelConsentStatus,
  eventType: GrowthIntentPixelEventType,
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
    return {
      mode: "rejected",
      accepted: false,
      reason: "Consent denied — analytics tracking blocked.",
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
