/** Intent Pixel consent category flags (Prompt 37). */

export const GROWTH_INTENT_CONSENT_CATEGORIES_QA_MARKER =
  "growth-intent-consent-categories-v1" as const

export const EQUIPIFY_INTENT_CONSENT_CATEGORIES_KEY = "equipify_intent_consent_categories" as const

export const INTENT_CONSENT_CATEGORY_KEYS = ["analytics", "personalization", "marketing"] as const

export type IntentConsentCategoryKey = (typeof INTENT_CONSENT_CATEGORY_KEYS)[number]

export type IntentConsentCategories = Record<IntentConsentCategoryKey, boolean>

export type AnonymousPersonalizationSegment = {
  industry_affinity: string | null
  content_affinity: string | null
  returning_visitor: boolean
  visit_count: number
  last_industry_slug: string | null
  recommended_cta: string | null
  recommended_case_study_slug: string | null
}

export const NO_CONSENT_CATEGORIES: IntentConsentCategories = {
  analytics: false,
  personalization: false,
  marketing: false,
}

export const ALL_CONSENT_CATEGORIES: IntentConsentCategories = {
  analytics: true,
  personalization: true,
  marketing: true,
}

export function normalizeConsentCategories(value: unknown): IntentConsentCategories {
  if (!value || typeof value !== "object") return { ...NO_CONSENT_CATEGORIES }
  const raw = value as Record<string, unknown>
  return {
    analytics: raw.analytics === true,
    personalization: raw.personalization === true,
    marketing: raw.marketing === true,
  }
}

export function categoriesFromAggregateStatus(
  status: "granted" | "denied" | "unknown" | "not_required",
): IntentConsentCategories {
  if (status === "granted" || status === "not_required") return { ...ALL_CONSENT_CATEGORIES }
  return { ...NO_CONSENT_CATEGORIES }
}

export function deriveAggregateConsentStatus(
  categories: IntentConsentCategories,
): "granted" | "denied" {
  return categories.analytics || categories.personalization || categories.marketing
    ? "granted"
    : "denied"
}

export function hasAnyConsentCategory(categories: IntentConsentCategories): boolean {
  return categories.analytics || categories.personalization || categories.marketing
}

export function mergeConsentCategories(
  base: IntentConsentCategories,
  patch: Partial<IntentConsentCategories>,
): IntentConsentCategories {
  return {
    analytics: patch.analytics ?? base.analytics,
    personalization: patch.personalization ?? base.personalization,
    marketing: patch.marketing ?? base.marketing,
  }
}

export function resolveEffectiveConsentCategories(input: {
  consent_status: "unknown" | "denied" | "granted" | "not_required"
  consent_categories?: Partial<IntentConsentCategories> | null
}): IntentConsentCategories {
  if (input.consent_status === "unknown") return { ...NO_CONSENT_CATEGORIES }
  if (input.consent_status === "denied") return { ...NO_CONSENT_CATEGORIES }
  if (input.consent_status === "not_required") return { ...ALL_CONSENT_CATEGORIES }
  if (input.consent_categories) return normalizeConsentCategories(input.consent_categories)
  return categoriesFromAggregateStatus("granted")
}

export function allowsAnalyticsCategory(categories: IntentConsentCategories): boolean {
  return categories.analytics === true
}

export function allowsPersonalizationCategory(categories: IntentConsentCategories): boolean {
  return categories.personalization === true
}

export function allowsMarketingCategory(categories: IntentConsentCategories): boolean {
  return categories.marketing === true
}
