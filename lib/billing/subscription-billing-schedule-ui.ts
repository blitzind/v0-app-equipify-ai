import type { OrganizationSubscription } from "@/lib/billing/subscriptions"
import { getEffectiveBillingStatus } from "@/lib/billing/subscriptions"

export type BillingScheduleUiSnapshot = {
  /** Single customer-facing line for the manage-billing dialog */
  primaryLine: string
  /** Short formatted date for “· Renews …” in the subscription summary; omit when null */
  renewsDateDisplay: string | null
  /** Formatted date for cancel-at-period-end copy; omit when null */
  accessEndsDateDisplay: string | null
}

/** Prefer the first argument when it yields a valid calendar date (YYYY-MM-DD). */
export function pickFirstYmd(a: string | null | undefined, b: string | null | undefined): string | null {
  return extractYmd(a) ?? extractYmd(b)
}

function extractYmd(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const s = iso.trim()
  const ymd = s.length >= 10 ? s.slice(0, 10) : s
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  if (Number.isNaN(Date.parse(`${ymd}T12:00:00Z`))) return null
  return ymd
}

/**
 * Customer-facing subscription schedule copy for Settings → Billing.
 * Uses only merged DB + optional Stripe-backed instants; never workspace mock fields.
 */
export function buildBillingScheduleUiSnapshot(
  subscription: OrganizationSubscription | null,
  stripeSchedule: { trialEndIso: string | null; currentPeriodEndIso: string | null } | null,
  fmtIsoDate: (ymd: string) => string,
): BillingScheduleUiSnapshot {
  const empty: BillingScheduleUiSnapshot = {
    primaryLine: "Next billing date unavailable",
    renewsDateDisplay: null,
    accessEndsDateDisplay: null,
  }

  if (!subscription) return empty

  const effectiveStatus = getEffectiveBillingStatus(subscription)
  const { status, cancel_at_period_end: cancelAtPeriodEnd } = subscription
  const trialYmd = pickFirstYmd(subscription.trial_ends_at, stripeSchedule?.trialEndIso)
  const periodYmd = pickFirstYmd(subscription.current_period_end, stripeSchedule?.currentPeriodEndIso)

  if (status === "past_due" || status === "unpaid" || effectiveStatus === "trial_expired") {
    return { primaryLine: "Payment needed", renewsDateDisplay: null, accessEndsDateDisplay: null }
  }

  if (status === "incomplete" || status === "incomplete_expired") {
    return { primaryLine: "Payment needed", renewsDateDisplay: null, accessEndsDateDisplay: null }
  }

  if (effectiveStatus === "trialing") {
    if (trialYmd) {
      return {
        primaryLine: `Trial ends ${fmtIsoDate(trialYmd)}`,
        renewsDateDisplay: null,
        accessEndsDateDisplay: null,
      }
    }
    if (periodYmd) {
      return {
        primaryLine: `Billing starts ${fmtIsoDate(periodYmd)}`,
        renewsDateDisplay: null,
        accessEndsDateDisplay: null,
      }
    }
    return empty
  }

  if (cancelAtPeriodEnd && periodYmd) {
    const d = fmtIsoDate(periodYmd)
    return {
      primaryLine: `Access ends ${d}`,
      renewsDateDisplay: null,
      accessEndsDateDisplay: d,
    }
  }

  if (status === "active") {
    if (periodYmd) {
      const d = fmtIsoDate(periodYmd)
      return {
        primaryLine: `Next renewal ${d}`,
        renewsDateDisplay: d,
        accessEndsDateDisplay: null,
      }
    }
    return empty
  }

  if (status === "canceled") {
    if (periodYmd) {
      const d = fmtIsoDate(periodYmd)
      return { primaryLine: `Access ends ${d}`, renewsDateDisplay: null, accessEndsDateDisplay: d }
    }
    return empty
  }

  return empty
}
