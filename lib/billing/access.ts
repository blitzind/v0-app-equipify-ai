import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import {
  getEffectiveBillingStatus,
  getTrialDaysRemaining,
  isTrialActive,
  type EffectiveBillingStatus,
} from "@/lib/billing/subscriptions"

/** Trial ending warning when at or below this many whole days (still active). */
export const TRIAL_ENDING_WARNING_DAYS = 7

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
    return "Your trial has ended. Update billing to keep creating records and avoid interruption."
  }

  if (subscription.status === "past_due") {
    return "Payment failed or past due. Update your payment method to stay active."
  }

  if (subscription.status === "unpaid") {
    return "Your subscription is unpaid. Visit billing to resolve and restore access."
  }

  if (subscription.status === "canceled") {
    return "Your subscription has ended. Renew in billing to create new records."
  }

  if (subscription.status === "paused") {
    return "Your subscription is paused. Resume billing to create new records."
  }

  if (subscription.status === "incomplete_expired") {
    return "Checkout was not completed. Finish setup in billing to continue."
  }

  if (subscription.status === "incomplete") {
    return "Your subscription setup is incomplete. Finish checkout in billing."
  }

  if (subscription.status === "active" && subscription.cancel_at_period_end) {
    return "Your subscription is set to cancel at period end. You can manage billing anytime."
  }

  if (state.level === "restricted") {
    return "Your subscription needs attention. Open billing to continue creating records."
  }

  if (state.effectiveStatus === "trialing" && isTrialActive(subscription)) {
    const d = getTrialDaysRemaining(subscription)
    if (d > 0 && d <= TRIAL_ENDING_WARNING_DAYS) {
      return d === 1
        ? "Your trial ends tomorrow. Add billing details to continue without interruption."
        : `Your trial ends in ${d} days. Review billing before it ends.`
    }
  }

  return null
}
