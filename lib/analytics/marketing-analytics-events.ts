import {
  getGa4MeasurementId,
  getGoogleAdsSignupSendTo,
  isMarketingAnalyticsEnabled,
} from "@/lib/analytics/marketing-analytics-config"
import { marketingAnalyticsDebug } from "@/lib/analytics/marketing-analytics-debug"

export type OnboardingCompletionFlow = "self_serve" | "invite"

const SESSION_KEY_PREFIX = "equipify_mk_analytics_fired:"

function storageKey(kind: string, userId: string, organizationId: string) {
  return `${SESSION_KEY_PREFIX}${kind}:${userId}:${organizationId}`
}

function alreadyFired(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function markFired(key: string) {
  try {
    sessionStorage.setItem(key, "1")
  } catch {
    /* private mode / blocked */
  }
}

function invokeGtag(args: unknown[]) {
  if (typeof window === "undefined") return
  const gtag = window.gtag
  if (typeof gtag !== "function") {
    marketingAnalyticsDebug("event skipped: gtag missing", args)
    return
  }
  gtag(...(args as [string, ...unknown[]]))
}

/**
 * Google Ads conversion — only when `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO` is set.
 * Fired from `trackOnboardingCompleted` only (deduped per session + user + org).
 */
function fireGoogleAdsSignupConversionOnce(userId: string, organizationId: string) {
  const sendTo = getGoogleAdsSignupSendTo()
  if (!sendTo) {
    marketingAnalyticsDebug("Ads conversion skipped: NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO unset")
    return
  }
  const key = `${SESSION_KEY_PREFIX}ads_signup:${userId}:${organizationId}`
  if (alreadyFired(key)) {
    marketingAnalyticsDebug("Ads conversion deduped", { userId, organizationId })
    return
  }
  markFired(key)
  const transaction_id = `${userId}:${organizationId}`
  invokeGtag([
    "event",
    "conversion",
    {
      send_to: sendTo,
      transaction_id,
    },
  ])
  marketingAnalyticsDebug("Ads conversion", { send_to: sendTo, transaction_id })
}

/**
 * Fires after the server confirms workspace provisioning (includes trial bootstrap).
 * Maps to GA4 `free_trial_signup` and optional Ads conversion (same send_to as onboarding if configured).
 */
export function trackFreeTrialSignup(params: {
  userId: string
  organizationId: string
  selectedPlan?: string | null
}) {
  if (!isMarketingAnalyticsEnabled()) return
  const { userId, organizationId, selectedPlan } = params
  const dedupeKey = storageKey("free_trial_signup", userId, organizationId)
  if (alreadyFired(dedupeKey)) {
    marketingAnalyticsDebug("free_trial_signup deduped", params)
    return
  }
  markFired(dedupeKey)

  if (getGa4MeasurementId()) {
    invokeGtag([
      "event",
      "free_trial_signup",
      {
        organization_id: organizationId,
        plan: selectedPlan ?? undefined,
      },
    ])
    marketingAnalyticsDebug("GA4 free_trial_signup", params)
  }
}

/**
 * Fires after successful onboarding completion (self-serve provision or invite accept).
 * GA4 recommended `sign_up` plus custom `onboarding_completed`.
 */
export function trackOnboardingCompleted(params: {
  userId: string
  organizationId: string
  flow: OnboardingCompletionFlow
}) {
  if (!isMarketingAnalyticsEnabled()) return
  const { userId, organizationId, flow } = params
  const dedupeKey = storageKey("onboarding_completed", userId, organizationId)
  if (alreadyFired(dedupeKey)) {
    marketingAnalyticsDebug("onboarding_completed deduped", params)
    return
  }
  markFired(dedupeKey)

  if (getGa4MeasurementId()) {
    invokeGtag([
      "event",
      "sign_up",
      {
        method: flow === "invite" ? "invite" : "email",
      },
    ])
    invokeGtag([
      "event",
      "onboarding_completed",
      {
        flow,
        organization_id: organizationId,
      },
    ])
    marketingAnalyticsDebug("GA4 sign_up + onboarding_completed", params)
  }

  fireGoogleAdsSignupConversionOnce(userId, organizationId)
}
