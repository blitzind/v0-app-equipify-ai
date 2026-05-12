"use server"

import { getStripe } from "@/lib/stripe"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
import {
  logStripeSaaSBillingFailure,
  tryClearStaleStripeCustomerId,
  userFacingStripeSaaSBillingError,
} from "@/lib/billing/stripe-saas-billing-errors"
import {
  getOrganizationSubscription,
  normalizeOrganizationSubscription,
  normalizeStripeIdColumn,
  type OrganizationSubscription,
} from "@/lib/billing/subscriptions"

const BILLING_SOURCE = "equipify_billing_page_setup"
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

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
  if (error) throw new Error(error.message)
  return await getOrganizationSubscription(admin, organizationId)
}

export async function createSetupIntent(): Promise<{ clientSecret: string | null; error?: string }> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { clientSecret: null, error: "Stripe is not configured." }
  }
  const stripe = getStripe()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { clientSecret: null, error: "You must be signed in to continue." }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) return { clientSecret: null, error: resolved.error }

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
        : userFacingStripeSaaSBillingError(e, "setup"),
    }
  }

  const organizationId = resolved.organizationId
  let sub: OrganizationSubscription | null
  try {
    sub = await ensureOrganizationSubscriptionRow(admin, organizationId)
  } catch (e) {
    logStripeSaaSBillingFailure("createSetupIntent.ensureOrganizationSubscriptionRow", organizationId, e)
    return { clientSecret: null, error: "Could not prepare billing profile. Please try again or contact support." }
  }
  if (!sub) return { clientSecret: null, error: "Could not load subscription for this organization." }

  let stripeCustomerId = normalizeStripeIdColumn(sub.stripe_customer_id)
  if (!stripeCustomerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle()

    const customer = await stripe.customers.create({
      email: typeof profile?.email === "string" ? profile.email.trim() || undefined : undefined,
      name: typeof profile?.full_name === "string" ? profile.full_name.trim() || undefined : undefined,
      metadata: {
        organization_id: organizationId,
        source: BILLING_SOURCE,
      },
    })

    stripeCustomerId = normalizeStripeIdColumn(customer.id)
    if (!stripeCustomerId) return { clientSecret: null, error: "Stripe did not return a valid customer id." }

    const { error: saveCustomerErr } = await admin
      .from("organization_subscriptions")
      .update({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
    if (saveCustomerErr) {
      logStripeSaaSBillingFailure("createSetupIntent.saveStripeCustomerId", organizationId, saveCustomerErr)
      return { clientSecret: null, error: "Could not save billing profile. Please try again or contact support." }
    }
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        organization_id: organizationId,
        source: BILLING_SOURCE,
      },
    })
    return { clientSecret: setupIntent.client_secret }
  } catch (err) {
    logStripeSaaSBillingFailure("createSetupIntent.setupIntents.create", organizationId, err)
    if (stripeCustomerId) {
      await tryClearStaleStripeCustomerId(admin, organizationId, stripeCustomerId, err)
    }
    return { clientSecret: null, error: userFacingStripeSaaSBillingError(err, "setup") }
  }
}
