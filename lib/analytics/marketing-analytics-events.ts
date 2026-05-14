import {
  getGa4MeasurementId,
  getGoogleAdsSignupSendTo,
  isMarketingAnalyticsDebugEnabled,
  isMarketingAnalyticsEnabled,
} from "@/lib/analytics/marketing-analytics-config"
import {
  marketingAnalyticsDebug,
  onboardingAnalyticsDevLog,
} from "@/lib/analytics/marketing-analytics-debug"

export type OnboardingCompletionFlow = "self_serve" | "invite"

const SESSION_KEY_PREFIX = "equipify_mk_analytics_fired:"

function logTempGoogleAdsConversionMessage(message: "fired" | "callback") {
  if (process.env.NODE_ENV !== "development" && !isMarketingAnalyticsDebugEnabled()) return
  if (message === "fired") {
    console.info("Google Ads conversion fired")
  } else {
    console.info("Google Ads conversion callback executed")
  }
}

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
  try {
    gtag(...(args as [string, ...unknown[]]))
  } catch (err) {
    onboardingAnalyticsDevLog("gtag invoke threw (continuing)", err)
  }
}

const ADS_CONVERSION_SETTLE_MS = 1500

/**
 * Google Ads signup conversion — beacon + `event_callback` + timeout so navigation
 * can wait without racing the network. Calls `onSettled` exactly once.
 */
function fireGoogleAdsSignupConversionOnceWithSettle(
  userId: string,
  organizationId: string,
  onSettled: () => void,
) {
  if (typeof window === "undefined") {
    onSettled()
    return
  }

  const sendTo = getGoogleAdsSignupSendTo()
  if (!sendTo) {
    marketingAnalyticsDebug("Ads conversion skipped: NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO unset")
    onSettled()
    return
  }

  const key = `${SESSION_KEY_PREFIX}ads_signup:${userId}:${organizationId}`
  if (alreadyFired(key)) {
    marketingAnalyticsDebug("Ads conversion deduped", { userId, organizationId })
    onSettled()
    return
  }
  markFired(key)

  let settled = false
  let timerId: ReturnType<typeof window.setTimeout> | undefined

  const settle = () => {
    if (settled) return
    settled = true
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
      timerId = undefined
    }
    onSettled()
  }

  timerId = window.setTimeout(() => {
    onboardingAnalyticsDevLog("Google Ads conversion: timeout fallback before redirect")
    settle()
  }, ADS_CONVERSION_SETTLE_MS)

  const gtag = window.gtag
  if (typeof gtag !== "function") {
    marketingAnalyticsDebug("Ads conversion skipped: gtag missing")
    settle()
    return
  }

  const transaction_id = `${userId}:${organizationId}`

  logTempGoogleAdsConversionMessage("fired")
  onboardingAnalyticsDevLog("Google Ads conversion dispatch", {
    send_to: sendTo,
    transaction_id,
    transport_type: "beacon",
  })

  try {
    gtag("event", "conversion", {
      send_to: sendTo,
      transaction_id,
      transport_type: "beacon",
      event_callback: () => {
        logTempGoogleAdsConversionMessage("callback")
        onboardingAnalyticsDevLog("Google Ads conversion event_callback (settling)")
        settle()
      },
    })
  } catch (err) {
    onboardingAnalyticsDevLog("Google Ads conversion gtag threw; settling", err)
    settle()
  }
}

/**
 * Fires after the server confirms workspace provisioning (includes trial bootstrap).
 * Maps to GA4 `free_trial_signup`.
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
    onboardingAnalyticsDevLog("GA4 free_trial_signup dispatch", params)
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
 * GA4 `sign_up` + `onboarding_completed`, then optional Google Ads conversion (beacon +
 * callback + timeout). Always invokes `onRedirectReady` exactly once so callers can
 * navigate without racing the conversion hit.
 */
export function trackOnboardingCompleted(params: {
  userId: string
  organizationId: string
  flow: OnboardingCompletionFlow
  onRedirectReady: () => void
}) {
  const { userId, organizationId, flow, onRedirectReady } = params

  let redirectNotified = false
  const notifyRedirect = () => {
    if (redirectNotified) return
    redirectNotified = true
    try {
      onRedirectReady()
    } catch (err) {
      onboardingAnalyticsDevLog("onRedirectReady threw", err)
    }
  }

  try {
    if (!isMarketingAnalyticsEnabled()) {
      onboardingAnalyticsDevLog("trackOnboardingCompleted: analytics disabled, navigating")
      notifyRedirect()
      return
    }

    const dedupeKey = storageKey("onboarding_completed", userId, organizationId)
    if (alreadyFired(dedupeKey)) {
      marketingAnalyticsDebug("onboarding_completed deduped", params)
      onboardingAnalyticsDevLog(
        "onboarding_completed session dedupe — still calling onRedirectReady",
      )
      notifyRedirect()
      return
    }
    markFired(dedupeKey)

    if (getGa4MeasurementId()) {
      onboardingAnalyticsDevLog("GA4 sign_up dispatch", { flow })
      invokeGtag([
        "event",
        "sign_up",
        {
          method: flow === "invite" ? "invite" : "email",
        },
      ])
      onboardingAnalyticsDevLog("GA4 onboarding_completed dispatch", {
        flow,
        organizationId,
      })
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

    fireGoogleAdsSignupConversionOnceWithSettle(userId, organizationId, notifyRedirect)
  } catch (err) {
    onboardingAnalyticsDevLog("trackOnboardingCompleted unexpected error; navigating", err)
    notifyRedirect()
  }
}
