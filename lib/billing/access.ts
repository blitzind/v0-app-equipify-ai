import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import {
  getEffectiveBillingStatus,
  getTrialDaysRemaining,
  isTrialActive,
  type EffectiveBillingStatus,
} from "@/lib/billing/subscriptions"

/** Trial ending warning when at or below this many whole days (still active). */
export const TRIAL_ENDING_WARNING_DAYS = 7

/** Visual priority for the dashboard billing strip (Phase 60.4 — no hard lockout; copy stays honest). */
export type BillingAppBannerTone = "info" | "warning" | "critical"

export type BillingAccessLevel = "full" | "warning" | "restricted"

export type BillingAccessState = {
  level: BillingAccessLevel
  /** When false, block creating customers, equipment, work orders, quotes, invoices, maintenance plans (read-only OK). */
  allowRecordCreation: boolean
  effectiveStatus: EffectiveBillingStatus
}

/**
 * Derives subscription UX tier for billing gates (does not change stored rows).
 */
export function getBillingAccessState(subscription: OrganizationSubscription | null): BillingAccessState {
  // No row yet: treat as "open" for record creation so onboarding/demo and legacy orgs are not hard-blocked.
  // Product risk: orgs that never get a subscription row are not restricted here — see docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md.
  if (!subscription) {
    return { level: "full", allowRecordCreation: true, effectiveStatus: "none" }
  }

  const eff = getEffectiveBillingStatus(subscription)
  const st = subscription.status

  if (eff === "trialing") {
    return { level: "full", allowRecordCreation: true, effectiveStatus: "trialing" }
  }

  if (eff === "trial_expired") {
    return { level: "restricted", allowRecordCreation: false, effectiveStatus: "trial_expired" }
  }

  if (st === "active") {
    if (subscription.cancel_at_period_end) {
      return { level: "warning", allowRecordCreation: true, effectiveStatus: "active" }
    }
    return { level: "full", allowRecordCreation: true, effectiveStatus: "active" }
  }

  if (st === "past_due") {
    return { level: "warning", allowRecordCreation: true, effectiveStatus: "past_due" }
  }

  if (st === "incomplete") {
    return { level: "warning", allowRecordCreation: true, effectiveStatus: "incomplete" }
  }

  if (st === "unpaid" || st === "canceled" || st === "incomplete_expired" || st === "paused") {
    return { level: "restricted", allowRecordCreation: false, effectiveStatus: eff }
  }

  return { level: "full", allowRecordCreation: true, effectiveStatus: eff }
}

/**
 * True when the org may create new operational records (subject to plan limits).
 * False in restricted billing states (trial expired, unpaid, canceled, etc.).
 */
export function canAccessApp(subscription: OrganizationSubscription | null): boolean {
  return getBillingAccessState(subscription).allowRecordCreation
}

/**
 * True when a non-dismissable billing situation should show the app-wide strip.
 */
export function shouldShowBillingWarning(subscription: OrganizationSubscription | null): boolean {
  if (!subscription) return false
  const state = getBillingAccessState(subscription)
  if (state.level === "restricted") return true
  if (state.effectiveStatus === "trialing" && isTrialActive(subscription)) {
    const d = getTrialDaysRemaining(subscription)
    return d > 0 && d <= TRIAL_ENDING_WARNING_DAYS
  }
  if (subscription.status === "past_due") return true
  if (subscription.status === "incomplete") return true
  if (subscription.status === "active" && subscription.cancel_at_period_end) return true
  return false
}

/**
 * Primary banner copy; null if {@link shouldShowBillingWarning} is false.
 */
export function getBillingWarningMessage(subscription: OrganizationSubscription | null): string | null {
  if (!subscription) return null
  const state = getBillingAccessState(subscription)

  if (state.effectiveStatus === "trial_expired") {
    return "Your trial has ended. Update billing to continue creating new records."
  }

  if (subscription.status === "past_due") {
    return "Payment needs attention. Update your payment method to keep your subscription active."
  }

  if (subscription.status === "unpaid") {
    return "Your subscription is unpaid. Update billing to continue creating new records."
  }

  if (subscription.status === "canceled") {
    return "Your Equipify subscription has ended. Renew in billing to create new records again."
  }

  if (subscription.status === "paused") {
    return "Your subscription is paused. Resume billing in the customer portal to continue creating new records."
  }

  if (subscription.status === "incomplete_expired") {
    return "Checkout was not completed. Start again from billing when you are ready."
  }

  if (subscription.status === "incomplete") {
    return "Billing setup is not finished. Complete checkout to activate your subscription."
  }

  if (subscription.status === "active" && subscription.cancel_at_period_end) {
    return "Your subscription is set to cancel at the end of this period. You can update billing anytime."
  }

  if (state.level === "restricted") {
    return "Billing needs attention. Update billing to continue creating new records."
  }

  if (state.effectiveStatus === "trialing" && isTrialActive(subscription)) {
    const d = getTrialDaysRemaining(subscription)
    if (d > 0 && d <= TRIAL_ENDING_WARNING_DAYS) {
      return d === 1
        ? "Your trial ends tomorrow. Review billing to avoid interruption."
        : `Your trial ends in ${d} days. Review billing to avoid interruption.`
    }
  }

  return null
}

/**
 * Stripe emphasis for the app strip (not shown when {@link shouldShowBillingWarning} is false).
 */
export function getBillingAppBannerTone(subscription: OrganizationSubscription | null): BillingAppBannerTone {
  if (!subscription) return "info"
  const state = getBillingAccessState(subscription)

  if (state.level === "restricted") return "critical"

  if (subscription.status === "past_due" || subscription.status === "incomplete") return "warning"

  if (subscription.status === "active" && subscription.cancel_at_period_end) return "warning"

  if (state.effectiveStatus === "trialing" && isTrialActive(subscription)) {
    const d = getTrialDaysRemaining(subscription)
    if (d > 0 && d <= 2) return "critical"
    if (d > 0 && d <= TRIAL_ENDING_WARNING_DAYS) return "warning"
  }

  return "warning"
}

/**
 * Billing page / docs: short note when there is no `organization_subscriptions` row (creation still allowed by policy).
 */
export const MISSING_SUBSCRIPTION_BILLING_NOTE =
  "No Equipify subscription is on file for this workspace yet. You can keep working; connect billing when you are ready to choose a plan and manage renewal in Stripe."
