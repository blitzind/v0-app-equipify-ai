/** Intent Pixel first-party consent manager (Prompt 36). */

export const GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER =
  "growth-intent-consent-manager-v1" as const

export const EQUIPIFY_INTENT_CONSENT_STORAGE_KEY = "equipify_intent_consent" as const

export const EQUIPIFY_INTENT_CONSENT_TIMESTAMP_KEY = "equipify_intent_consent_ts" as const

/** Consent preference TTL — 365 days. */
export const EQUIPIFY_INTENT_CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export const EQUIPIFY_INTENT_CONSENT_STATUSES = ["granted", "denied", "unknown"] as const

export type EquipifyIntentConsentStatus = (typeof EQUIPIFY_INTENT_CONSENT_STATUSES)[number]

/** Conversion types allowed when analytics consent is denied. */
export const EXPLICIT_CAPTURE_CONVERSION_TYPES = [
  "form_submit",
  "booking",
  "chat",
  "login",
  "lead_capture",
] as const

export type ExplicitCaptureConversionType = (typeof EXPLICIT_CAPTURE_CONVERSION_TYPES)[number]

/** When denied + unknown exceed this share of resolved consent, tracking visibility is impacted. */
export const TRACKING_VISIBILITY_IMPACTED_THRESHOLD = 0.45
