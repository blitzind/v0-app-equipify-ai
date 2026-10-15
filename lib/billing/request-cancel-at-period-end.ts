/**
 * Period-end SaaS cancellation helpers (no immediate cancel, refund, or proration).
 * Stripe Dashboard Billing Portal is not used: its cancel/refund products are not verified.
 */

export const PERIOD_END_CANCEL_UNSUPPORTED_STATUSES = new Set(["canceled", "incomplete_expired"])

export function shouldScheduleCancelAtPeriodEnd(input: {
  stripeStatus: string
  cancelAtPeriodEnd: boolean
}): "already_scheduled" | "schedule" | "rejected" {
  if (PERIOD_END_CANCEL_UNSUPPORTED_STATUSES.has(input.stripeStatus)) return "rejected"
  if (input.cancelAtPeriodEnd) return "already_scheduled"
  return "schedule"
}

export function periodEndCancelConfirmationMessage(periodEndIso: string | null): string {
  if (!periodEndIso) {
    return "Your subscription is set to cancel at the end of the current billing period. Access continues until then. No refund is issued for time already paid."
  }
  const day = periodEndIso.slice(0, 10)
  return `Your subscription is set to cancel on ${day}. Access continues until then. No refund is issued for time already paid.`
}

/** Stripe subscription.customer as a normalized id string. */
export function stripeSubscriptionCustomerId(
  customer: string | { id: string; deleted?: boolean } | null | undefined,
): string | null {
  if (customer == null) return null
  if (typeof customer === "string") return customer.trim() || null
  if (customer.deleted) return null
  return customer.id?.trim() || null
}

export type PeriodEndCancelOwnershipCheck =
  | { ok: true }
  | { ok: false; code: "subscription_org_mismatch" | "customer_mismatch" }

/**
 * Ensures the Stripe subscription being canceled is tied to the active organization row.
 * Does not call Stripe; used before scheduling cancel_at_period_end.
 */
export function verifyPeriodEndCancelOwnership(input: {
  activeOrganizationId: string
  subscriptionRowOrganizationId: string | null | undefined
  orgStripeCustomerId: string | null
  stripeSubscriptionCustomerId: string | null
}): PeriodEndCancelOwnershipCheck {
  if (
    input.subscriptionRowOrganizationId &&
    input.subscriptionRowOrganizationId !== input.activeOrganizationId
  ) {
    return { ok: false, code: "subscription_org_mismatch" }
  }
  const orgCust = input.orgStripeCustomerId?.trim() || null
  const stripeCust = input.stripeSubscriptionCustomerId?.trim() || null
  if (orgCust && stripeCust && orgCust !== stripeCust) {
    return { ok: false, code: "customer_mismatch" }
  }
  return { ok: true }
}

export function periodEndCancelOwnershipErrorMessage(
  code: "subscription_org_mismatch" | "customer_mismatch",
): string {
  if (code === "subscription_org_mismatch") {
    return "This subscription is not linked to your workspace. Contact support to resolve billing."
  }
  return "The subscription on file does not match your billing profile. Contact support before canceling."
}
