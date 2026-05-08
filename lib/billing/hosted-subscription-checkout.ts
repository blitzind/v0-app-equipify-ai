import "server-only"

import type { PlanId } from "@/lib/plans"
import { getStripe } from "@/lib/stripe"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  priceIdForPlan,
  validateCheckoutPlanAndCycle,
  validateStripePriceId,
} from "@/lib/billing/stripe-price-validation"
import {
  getOrganizationSubscription,
  getTrialDaysRemaining,
  isTrialActive,
  normalizeOrganizationSubscription,
  normalizeStripeIdColumn,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const HOSTED_SOURCE = "equipify_hosted_checkout"

function computeStripeTrialPeriodDays(sub: OrganizationSubscription): number | null {
  if (normalizeStripeIdColumn(sub.stripe_subscription_id)) {
    return null
  }
  if (sub.status !== "trialing" || !isTrialActive(sub)) {
    return null
  }
  const days = getTrialDaysRemaining(sub)
  if (days <= 0) {
    return null
  }
  return days
}

async function ensureOrganizationSubscriptionRow(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  let row = await getOrganizationSubscription(admin, organizationId)
  if (row) return row

  const trialEnd = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()
  const { data: inserted, error } = await admin
    .from("organization_subscriptions")
    .insert({
      organization_id: organizationId,
      plan_id: "solo",
      billing_cycle: "monthly",
      status: "trialing",
      trial_starts_at: new Date().toISOString(),
      trial_ends_at: trialEnd,
    })
    .select("*")
    .maybeSingle()

  if (!error && inserted) {
    return normalizeOrganizationSubscription(inserted as OrganizationSubscription)
  }

  if (error?.code === "23505") {
    row = await getOrganizationSubscription(admin, organizationId)
    return row
  }

  if (error) {
    throw new Error(error.message)
  }

  return await getOrganizationSubscription(admin, organizationId)
}

export type HostedSubscriptionCheckoutResult = { url: string | null; error?: string }

/**
 * Stripe Checkout (hosted, redirect) for subscription mode.
 * Sync to `organization_subscriptions` happens via `/api/stripe/webhook` (`checkout.session.completed`).
 *
 * `params.organizationId` must be the workspace UUID (from `POST /api/billing/checkout`, which uses
 * the signed-in user’s active organization via {@link resolveActiveOrganizationForUser} unless overridden).
 */
export async function createHostedSubscriptionCheckout(params: {
  organizationId: string
  userId: string
  planId: PlanId
  billingCycle: "monthly" | "annual"
  origin: string
  /** When true, do not send Stripe trial days (e.g. platform-admin “convert to paid”). */
  skipTrial?: boolean
}): Promise<HostedSubscriptionCheckoutResult> {
  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Stripe is not configured." }
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      url: null,
      error:
        msg.includes("SUPABASE_SERVICE_ROLE_KEY") ?
          "Billing server is not configured (missing SUPABASE_SERVICE_ROLE_KEY)."
        : msg,
    }
  }

  const planValidated = validateCheckoutPlanAndCycle(params.planId, params.billingCycle)
  if (!planValidated.ok) {
    return { url: null, error: planValidated.error }
  }

  const priceId = priceIdForPlan(params.planId, params.billingCycle)
  const priceValidated = validateStripePriceId(priceId)
  if (!priceValidated.ok) {
    return { url: null, error: priceValidated.error }
  }

  let sub: OrganizationSubscription | null
  try {
    sub = await ensureOrganizationSubscriptionRow(admin, params.organizationId)
  } catch (e) {
    return {
      url: null,
      error: e instanceof Error ? e.message : "Could not prepare subscription row.",
    }
  }

  if (!sub) {
    return { url: null, error: "Could not load subscription for this organization." }
  }

  let stripeCustomerId: string | null = normalizeStripeIdColumn(sub.stripe_customer_id)
  if (!stripeCustomerId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", params.userId)
      .maybeSingle()

    const customer = await stripe.customers.create({
      email: typeof profile?.email === "string" ? profile.email.trim() || undefined : undefined,
      name:
        typeof profile?.full_name === "string" ? profile.full_name.trim() || undefined : undefined,
      metadata: {
        organization_id: params.organizationId,
        source: HOSTED_SOURCE,
      },
    })

    const persistedCustomerId = normalizeStripeIdColumn(customer.id)
    if (!persistedCustomerId) {
      return { url: null, error: "Stripe did not return a valid customer id." }
    }

    const { error: saveCustomerErr } = await admin
      .from("organization_subscriptions")
      .update({
        stripe_customer_id: persistedCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", params.organizationId)

    if (saveCustomerErr) {
      return { url: null, error: saveCustomerErr.message }
    }

    stripeCustomerId = persistedCustomerId
    sub = (await getOrganizationSubscription(admin, params.organizationId)) ?? sub
  }

  if (!stripeCustomerId) {
    return { url: null, error: "Missing Stripe customer for checkout." }
  }

  // Session + subscription metadata: `organizationId` is what webhooks read (`checkout.session.completed`).
  const orgId = params.organizationId
  const baseMeta = {
    organizationId: orgId,
    organization_id: orgId,
    plan_id: params.planId,
    planId: params.planId,
    billing_cycle: params.billingCycle,
    billingCycle: params.billingCycle === "annual" ? "yearly" : "monthly",
    source: HOSTED_SOURCE,
  }

  const subscriptionData: {
    metadata: Record<string, string>
    trial_period_days?: number
  } = {
    metadata: {
      organizationId: orgId,
      organization_id: orgId,
      plan_id: params.planId,
      planId: params.planId,
      billing_cycle: params.billingCycle,
      billingCycle: params.billingCycle === "annual" ? "yearly" : "monthly",
      source: HOSTED_SOURCE,
    },
  }

  if (!params.skipTrial) {
    const trialDays = computeStripeTrialPeriodDays(sub)
    if (trialDays !== null && trialDays >= 1) {
      subscriptionData.trial_period_days = trialDays
    }
  }

  const successUrl = `${params.origin.replace(/\/$/, "")}/settings/billing?checkout_success=1`
  const cancelUrl = `${params.origin.replace(/\/$/, "")}/settings/billing?checkout_canceled=1`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: params.organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: baseMeta,
      subscription_data: subscriptionData,
    })

    const url = typeof session.url === "string" ? session.url : null
    if (!url) {
      return { url: null, error: "Stripe did not return a checkout URL." }
    }
    return { url }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error"
    return { url: null, error: message }
  }
}
