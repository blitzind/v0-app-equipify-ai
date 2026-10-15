/**
 * Testable period-end cancellation orchestration (no live Stripe; inject dependencies).
 * Stripe remains source of truth; local patch is best-effort until webhooks reconcile.
 */

import type Stripe from "stripe"

import {
  periodEndCancelConfirmationMessage,
  periodEndCancelOwnershipErrorMessage,
  shouldScheduleCancelAtPeriodEnd,
  stripeSubscriptionCustomerId,
  verifyPeriodEndCancelOwnership,
} from "@/lib/billing/request-cancel-at-period-end"

export type PeriodEndCancelStripeSubscription = {
  id: string
  status: string
  cancel_at_period_end: boolean
  customer: string | { id: string; deleted?: boolean }
  current_period_end?: number
}

/** Normalize Stripe SDK subscription objects for {@link runPeriodEndCancelFlow} deps. */
export function stripeSubscriptionForPeriodEndCancelFlow(
  subscription: Stripe.Subscription,
): PeriodEndCancelStripeSubscription {
  const customer = subscription.customer
  const normalizedCustomer: PeriodEndCancelStripeSubscription["customer"] =
    typeof customer === "string"
      ? customer
      : customer.deleted
        ? { id: customer.id, deleted: true }
        : { id: customer.id }

  const currentPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end

  return {
    id: subscription.id,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    customer: normalizedCustomer,
    current_period_end: currentPeriodEnd,
  }
}

export type PeriodEndCancelLocalSubscription = {
  stripe_customer_id: string | null
  current_period_end: string | null
}

export type PeriodEndCancelDeps = {
  retrieveSubscription: (stripeSubscriptionId: string) => Promise<PeriodEndCancelStripeSubscription>
  scheduleCancelAtPeriodEnd: (stripeSubscriptionId: string) => Promise<PeriodEndCancelStripeSubscription>
  lookupSubscriptionOwnerOrganizationId: (
    stripeSubscriptionId: string,
  ) => Promise<string | null | undefined>
  upsertLocalSubscription: (patch: {
    cancel_at_period_end: boolean
    current_period_end: string | null
    status: string
    updated_at: string
  }) => Promise<void>
  mapStripeStatus: (status: string) => string
  unixSecondsToIso: (seconds: number | undefined) => string | null
}

export type PeriodEndCancelFlowResult =
  | {
      ok: true
      alreadyScheduled?: boolean
      periodEndIso?: string | null
      message?: string
      localSyncPending?: boolean
    }
  | { ok: false; error: string; code?: string }

export async function runPeriodEndCancelFlow(input: {
  organizationId: string
  stripeSubscriptionId: string
  localSubscription: PeriodEndCancelLocalSubscription | null
  deps: PeriodEndCancelDeps
}): Promise<PeriodEndCancelFlowResult> {
  const { organizationId, stripeSubscriptionId, localSubscription, deps } = input

  let stripeSub: PeriodEndCancelStripeSubscription
  try {
    stripeSub = await deps.retrieveSubscription(stripeSubscriptionId)
  } catch {
    return { ok: false, error: "Could not load your subscription. Try again or contact support.", code: "stripe_retrieve_failed" }
  }

  const subscriptionOwnerOrgId = await deps.lookupSubscriptionOwnerOrganizationId(stripeSubscriptionId)
  const ownership = verifyPeriodEndCancelOwnership({
    activeOrganizationId: organizationId,
    subscriptionRowOrganizationId: subscriptionOwnerOrgId,
    orgStripeCustomerId: localSubscription?.stripe_customer_id ?? null,
    stripeSubscriptionCustomerId: stripeSubscriptionCustomerId(stripeSub.customer),
  })
  if (!ownership.ok) {
    return { ok: false, error: periodEndCancelOwnershipErrorMessage(ownership.code), code: ownership.code }
  }

  const decision = shouldScheduleCancelAtPeriodEnd({
    stripeStatus: stripeSub.status,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  })
  if (decision === "rejected") {
    return { ok: false, error: "This subscription is already canceled.", code: "already_canceled" }
  }

  let updated = stripeSub
  if (decision === "schedule") {
    try {
      updated = await deps.scheduleCancelAtPeriodEnd(stripeSubscriptionId)
    } catch {
      return {
        ok: false,
        error: "Could not schedule cancellation with the payment provider. Try again or contact support.",
        code: "stripe_update_failed",
      }
    }
  }

  const periodEndIso =
    deps.unixSecondsToIso(updated.current_period_end) ?? localSubscription?.current_period_end ?? null

  const baseMessage = periodEndCancelConfirmationMessage(periodEndIso)

  try {
    await deps.upsertLocalSubscription({
      cancel_at_period_end: true,
      current_period_end: periodEndIso,
      status: deps.mapStripeStatus(updated.status),
      updated_at: new Date().toISOString(),
    })
  } catch {
    return {
      ok: true,
      alreadyScheduled: decision === "already_scheduled",
      periodEndIso,
      localSyncPending: true,
      message: `${baseMessage} Your workspace may take a moment to reflect this change; billing status will update after the next sync.`,
    }
  }

  return {
    ok: true,
    alreadyScheduled: decision === "already_scheduled",
    periodEndIso,
    message: baseMessage,
  }
}
