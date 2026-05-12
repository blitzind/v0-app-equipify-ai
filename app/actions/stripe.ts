"use server"

import { getStripe } from "@/lib/stripe"
import type { PlanId } from "@/lib/plans"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
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
import { headers } from "next/headers"
import {
  logStripeSaaSBillingFailure,
  tryClearStaleStripeCustomerId,
  userFacingStripeSaaSBillingError,
} from "@/lib/billing/stripe-saas-billing-errors"

const BILLING_SOURCE = "equipify_billing_page"
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Stripe trial on the subscription: only when there is no Stripe subscription yet,
 * status is `trialing`, `trial_ends_at` is still in the future, and remaining whole days ≥ 1.
 * Remaining days use {@link getTrialDaysRemaining} (ceil, min 0). No second trial after
 * `stripe_subscription_id` is set.
 */
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

export async function createCheckoutSession(
  planId: PlanId,
  billingCycle: "monthly" | "annual",
): Promise<{ clientSecret: string | null; error?: string }> {
  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch (e) {
    logStripeSaaSBillingFailure("createCheckoutSession.getStripe", null, e)
    return { clientSecret: null, error: userFacingStripeSaaSBillingError(e, "checkout") }
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      clientSecret: null,
      error:
        msg.includes("SUPABASE_SERVICE_ROLE_KEY") ?
          "Billing server is not configured (missing SUPABASE_SERVICE_ROLE_KEY)."
        : userFacingStripeSaaSBillingError(e, "checkout"),
    }
  }

  const planValidated = validateCheckoutPlanAndCycle(planId, billingCycle)
  if (!planValidated.ok) {
    return { clientSecret: null, error: planValidated.error }
  }
  const plan = planValidated.plan

  const priceId = priceIdForPlan(planId, billingCycle)
  const priceValidated = validateStripePriceId(priceId)
  if (!priceValidated.ok) {
    return { clientSecret: null, error: priceValidated.error }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { clientSecret: null, error: "You must be signed in to continue to checkout." }
  }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) {
    return { clientSecret: null, error: resolved.error }
  }
  const organizationId = resolved.organizationId

  let sub: OrganizationSubscription | null
  try {
    sub = await ensureOrganizationSubscriptionRow(admin, organizationId)
  } catch (e) {
    logStripeSaaSBillingFailure("createCheckoutSession.ensureOrganizationSubscriptionRow", organizationId, e)
    return {
      clientSecret: null,
      error: "Could not prepare subscription row. Please try again or contact support.",
    }
  }

  if (!sub) {
    return { clientSecret: null, error: "Could not load subscription for this organization." }
  }

  let stripeCustomerId: string | null = normalizeStripeIdColumn(sub.stripe_customer_id)
  if (!stripeCustomerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle()

    const customer = await stripe.customers.create({
      email: typeof profile?.email === "string" ? profile.email.trim() || undefined : undefined,
      name:
        typeof profile?.full_name === "string" ? profile.full_name.trim() || undefined : undefined,
      metadata: {
        organization_id: organizationId,
        source: BILLING_SOURCE,
      },
    })

    const persistedCustomerId = normalizeStripeIdColumn(customer.id)
    if (!persistedCustomerId) {
      return { clientSecret: null, error: "Stripe did not return a valid customer id." }
    }

    const { error: saveCustomerErr } = await admin
      .from("organization_subscriptions")
      .update({
        stripe_customer_id: persistedCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)

    if (saveCustomerErr) {
      logStripeSaaSBillingFailure("createCheckoutSession.saveStripeCustomerId", organizationId, saveCustomerErr)
      return { clientSecret: null, error: "Could not save billing profile. Please try again or contact support." }
    }

    stripeCustomerId = persistedCustomerId
    sub = (await getOrganizationSubscription(admin, organizationId)) ?? sub
  }

  if (!stripeCustomerId) {
    return { clientSecret: null, error: "Missing Stripe customer for checkout." }
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000"

  const trialDays = computeStripeTrialPeriodDays(sub)

  const subscriptionData: {
    metadata: Record<string, string>
    trial_period_days?: number
  } = {
    metadata: {
      organizationId,
      organization_id: organizationId,
      plan_id: planId,
      billing_cycle: billingCycle,
      source: BILLING_SOURCE,
    },
  }
  if (trialDays !== null && trialDays >= 1) {
    subscriptionData.trial_period_days = trialDays
  }

  try {
    const session = await stripe.checkout.sessions.create({
      // @ts-expect-error Stripe Node `UiMode` can omit `embedded` (Embedded Checkout is valid at runtime).
      ui_mode: "embedded",
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        organizationId,
        organization_id: organizationId,
        plan_id: planId,
        billing_cycle: billingCycle,
        source: BILLING_SOURCE,
      },
      subscription_data: subscriptionData,
    })
    return { clientSecret: session.client_secret }
  } catch (err) {
    logStripeSaaSBillingFailure("createCheckoutSession.checkout.sessions.create", organizationId, err)
    await tryClearStaleStripeCustomerId(admin, organizationId, stripeCustomerId, err)
    return { clientSecret: null, error: userFacingStripeSaaSBillingError(err, "checkout") }
  }
}

/**
 * Stripe Billing Portal session for the SaaS subscription customer.
 * **Primary UX** is the in-app Manage billing dialog on `/settings/billing`; call this only after the user explicitly
 * opts in to an external Stripe-hosted page (advanced changes not yet mirrored in-app).
 */
export async function createPortalSession(): Promise<{ url: string | null; error?: string }> {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000"
  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch (e) {
    logStripeSaaSBillingFailure("createPortalSession.getStripe", null, e)
    return { url: null, error: userFacingStripeSaaSBillingError(e, "portal") }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { url: null, error: "You must be signed in to open the billing portal." }
  }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) {
    return { url: null, error: resolved.error }
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
        : userFacingStripeSaaSBillingError(e, "portal"),
    }
  }

  const sub = await getOrganizationSubscription(admin, resolved.organizationId)
  const customerId = normalizeStripeIdColumn(sub?.stripe_customer_id)
  if (!customerId) {
    return {
      url: null,
      error:
        "No billing profile on file yet. Add a payment method on this page, or choose a plan below to complete checkout.",
    }
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings/billing`,
    })
    return { url: session.url }
  } catch (err) {
    logStripeSaaSBillingFailure("createPortalSession.billingPortal.sessions.create", resolved.organizationId, err)
    await tryClearStaleStripeCustomerId(admin, resolved.organizationId, customerId, err)
    return { url: null, error: userFacingStripeSaaSBillingError(err, "portal") }
  }
}
