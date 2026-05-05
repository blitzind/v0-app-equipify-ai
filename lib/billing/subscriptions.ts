import type { SupabaseClient } from "@supabase/supabase-js"

const MS_PER_DAY = 86400 * 1000

/**
 * `organization_subscriptions` uses NULL for unset Stripe IDs; never persist empty strings.
 * Use when reading values or before writing `stripe_customer_id` / `stripe_subscription_id`.
 */
export function normalizeStripeIdColumn(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t === "" ? null : t
}

function normalizeSubscriptionStripeIds(row: OrganizationSubscription): OrganizationSubscription {
  return {
    ...row,
    stripe_customer_id: normalizeStripeIdColumn(row.stripe_customer_id),
    stripe_subscription_id: normalizeStripeIdColumn(row.stripe_subscription_id),
  }
}

/** Use when a row was not loaded via {@link getOrganizationSubscription} (e.g. insert payload). */
export function normalizeOrganizationSubscription(row: OrganizationSubscription): OrganizationSubscription {
  return normalizeSubscriptionStripeIds(row)
}

/** Row shape for `public.organization_subscriptions` (matches Supabase column names). */
export type OrganizationSubscription = {
  id: string
  organization_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan_id: string
  billing_cycle: string
  status: string
  trial_starts_at: string | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  payment_failed_at: string | null
  created_at: string
  updated_at: string
}

export type EffectiveBillingStatus =
  | "none"
  | "trialing"
  | "trial_expired"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"

/** Load the subscription row for an organization (at most one). */
export async function getOrganizationSubscription(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = (data ?? null) as OrganizationSubscription | null
  return row ? normalizeSubscriptionStripeIds(row) : null
}

/**
 * Normalized status for UX and gates: distinguishes ended trial while DB row may still say `trialing`
 * until webhooks update it.
 */
export function getEffectiveBillingStatus(
  subscription: OrganizationSubscription | null,
): EffectiveBillingStatus {
  if (!subscription) return "none"
  if (subscription.status === "trialing") {
    return isTrialActive(subscription) ? "trialing" : "trial_expired"
  }
  switch (subscription.status) {
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return subscription.status
    default:
      return "none"
  }
}

/** True when status is `trialing` and `trial_ends_at` is in the future. */
export function isTrialActive(subscription: OrganizationSubscription | null): boolean {
  if (!subscription || subscription.status !== "trialing") return false
  if (!subscription.trial_ends_at) return false
  return new Date(subscription.trial_ends_at).getTime() > Date.now()
}

/**
 * True when the org should be treated as having an active entitlement:
 * paid `active`, or `trialing` with trial not expired.
 */
export function isSubscriptionActive(subscription: OrganizationSubscription | null): boolean {
  if (!subscription) return false
  if (subscription.status === "active") return true
  if (subscription.status === "trialing") return isTrialActive(subscription)
  return false
}

/** Whole days until `trial_ends_at`; 0 if ended or missing; never negative. */
export function getTrialDaysRemaining(subscription: OrganizationSubscription | null): number {
  if (!subscription?.trial_ends_at) return 0
  const diffMs = new Date(subscription.trial_ends_at).getTime() - Date.now()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / MS_PER_DAY)
}
