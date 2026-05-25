/** Client-safe onboarding finalization types + copy (signup plan step). */

export type OnboardingSampleDataStatus =
  | "created"
  | "already_exists"
  | "skipped"
  | "warning"
  | "failed_non_blocking"

export const ONBOARDING_SAMPLE_DATA_WARNING_STORAGE_KEY = "equipify_onboarding_sample_warning" as const

export const ONBOARDING_DASHBOARD_HREF = "/" as const

export type OnboardingRedirectReason =
  | "invite"
  | "explicit_redirect"
  | "onboarding_dashboard"
  | "billing_intent"

export type OnboardingRedirectResolution = {
  href: string
  redirectReason: OnboardingRedirectReason
}

type SearchParamsLike = { get: (key: string) => string | null }

function isSafeInternalRedirect(path: string): boolean {
  const trimmed = path.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false
  if (trimmed.includes("://")) return false
  return true
}

/** Safe internal post-onboarding redirect from `?redirect=` or `?next=`. */
export function parseOnboardingExplicitRedirect(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    return isSafeInternalRedirect(decoded) ? decoded : null
  } catch {
    return isSafeInternalRedirect(raw) ? raw : null
  }
}

export function parseOnboardingRedirectInputs(searchParams: SearchParamsLike): {
  explicitRedirect: string | null
  billingIntent: boolean
} {
  const explicitRedirect =
    parseOnboardingExplicitRedirect(searchParams.get("redirect")) ??
    parseOnboardingExplicitRedirect(searchParams.get("next"))
  const billingIntentRaw =
    searchParams.get("billingIntent") ?? searchParams.get("billing_intent")
  const billingIntent = billingIntentRaw?.trim().toLowerCase() === "true"
  return { explicitRedirect, billingIntent }
}

function isBillingRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false
  const pathname = path.trim().split("?")[0] ?? ""
  return pathname === "/settings/billing" || pathname.startsWith("/settings/billing/")
}

export function resolveOnboardingRedirectTarget(input: {
  inviteFlow: boolean
  explicitRedirect: string | null
  billingIntent: boolean
  selectedPlan: string
}): OnboardingRedirectResolution {
  if (input.inviteFlow) {
    return { href: ONBOARDING_DASHBOARD_HREF, redirectReason: "invite" }
  }

  if (input.explicitRedirect) {
    const redirectReason: OnboardingRedirectReason = isBillingRedirectPath(input.explicitRedirect)
      ? "billing_intent"
      : "explicit_redirect"
    return { href: input.explicitRedirect, redirectReason }
  }

  if (input.billingIntent) {
    return {
      href: `/settings/billing?plan=${encodeURIComponent(input.selectedPlan)}&source=onboarding`,
      redirectReason: "billing_intent",
    }
  }

  return { href: ONBOARDING_DASHBOARD_HREF, redirectReason: "onboarding_dashboard" }
}

export function sampleDataWarningMessage(status: OnboardingSampleDataStatus | null | undefined): string | null {
  switch (status) {
    case "failed_non_blocking":
      return "Sample data could not be loaded. Your workspace is ready — import examples anytime under Settings → Sample data."
    case "warning":
      return "Sample data may be incomplete. You can re-import examples under Settings → Sample data."
    default:
      return null
  }
}

export function isBlockingProvisioningFailure(input: {
  ok?: boolean
  organizationId?: string | null
}): boolean {
  if (input.ok) return false
  return !input.organizationId
}
