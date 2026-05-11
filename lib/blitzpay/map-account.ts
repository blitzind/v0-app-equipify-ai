import "server-only"

import type Stripe from "stripe"

export type BlitzPayConnectStatus =
  | "not_started"
  | "onboarding_started"
  | "action_required"
  | "pending_verification"
  | "ready"
  | "disabled"

export type BlitzPayOrgConnectPatch = {
  stripe_connect_status: BlitzPayConnectStatus
  stripe_connect_onboarding_complete: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  stripe_details_submitted: boolean
  stripe_requirements_currently_due: unknown
  stripe_requirements_eventually_due: unknown
  stripe_requirements_past_due: unknown
  last_stripe_connect_sync_at: string
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string")
}

/**
 * Maps a Stripe Connect Account object to persisted organization columns.
 * Heuristic priority: disabled → action required (requirements) → ready → pending verification → onboarding.
 */
export function mapStripeAccountToBlitzPayOrgPatch(account: Stripe.Account): BlitzPayOrgConnectPatch {
  const now = new Date().toISOString()
  const req = account.requirements ?? undefined
  const currentlyDue = asStringArray(req?.currently_due)
  const eventuallyDue = asStringArray(req?.eventually_due)
  const pastDue = asStringArray(req?.past_due)
  const disabledReason = req?.disabled_reason

  const charges = Boolean(account.charges_enabled)
  const payouts = Boolean(account.payouts_enabled)
  const details = Boolean(account.details_submitted)

  let stripe_connect_status: BlitzPayConnectStatus

  if (disabledReason) {
    stripe_connect_status = "disabled"
  } else if (pastDue.length > 0 || currentlyDue.length > 0) {
    stripe_connect_status = "action_required"
  } else if (charges && payouts && details) {
    stripe_connect_status = "ready"
  } else if (details && (!charges || !payouts)) {
    stripe_connect_status = "pending_verification"
  } else {
    stripe_connect_status = "onboarding_started"
  }

  const stripe_connect_onboarding_complete = stripe_connect_status === "ready"

  return {
    stripe_connect_status,
    stripe_connect_onboarding_complete,
    stripe_charges_enabled: charges,
    stripe_payouts_enabled: payouts,
    stripe_details_submitted: details,
    stripe_requirements_currently_due: currentlyDue,
    stripe_requirements_eventually_due: eventuallyDue,
    stripe_requirements_past_due: pastDue,
    last_stripe_connect_sync_at: now,
  }
}
