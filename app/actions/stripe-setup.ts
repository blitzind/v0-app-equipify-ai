"use server"

import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
import { requireOrgPermissionForServerAction } from "@/lib/api/require-org-permission"
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
import {
  saasSubscriptionBillingFormSchema,
  type SaasSubscriptionBillingFormValues,
} from "@/lib/billing/saas-subscription-billing-setup"

const BILLING_SOURCE = "equipify_billing_page_setup"
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function stripeCustomerParamsFromBilling(v: SaasSubscriptionBillingFormValues): Stripe.CustomerUpdateParams {
  const params: Stripe.CustomerUpdateParams = {
    name: v.billingName,
    email: v.billingEmail,
    address: {
      line1: v.addressLine1,
      line2: v.addressLine2.trim() ? v.addressLine2.trim() : undefined,
      city: v.city,
      state: v.state,
      postal_code: v.postalCode,
      country: v.country,
    },
  }
  const phone = v.billingPhone.trim()
  if (phone) params.phone = phone
  return params
}

function mapStripeCustomerToPrefill(c: Stripe.Customer): Partial<SaasSubscriptionBillingFormValues> | null {
  const addr = c.address
  const partial: Partial<SaasSubscriptionBillingFormValues> = {
    billingName: typeof c.name === "string" ? c.name : "",
    billingEmail: typeof c.email === "string" ? c.email : "",
    billingPhone: typeof c.phone === "string" ? c.phone : "",
    addressLine1: addr?.line1 ?? "",
    addressLine2: addr?.line2 ?? "",
    city: addr?.city ?? "",
    state: addr?.state ?? "",
    postalCode: addr?.postal_code ?? "",
    country: typeof addr?.country === "string" ? addr.country.trim().toUpperCase() : "",
  }
  const has =
    partial.billingName?.trim() ||
    partial.billingEmail?.trim() ||
    partial.addressLine1?.trim() ||
    partial.city?.trim() ||
    partial.postalCode?.trim() ||
    (partial.country?.length === 2 && partial.country !== "")
  return has ? partial : null
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
  if (error) throw new Error(error.message)
  return await getOrganizationSubscription(admin, organizationId)
}

function formatBillingValidationError(parsed: { success: false; error: { issues: { message: string }[] } }) {
  const first = parsed.error.issues[0]?.message
  return first && first.trim() ? first.trim() : "Check your billing information and try again."
}

/**
 * Returns Stripe customer fields to merge over workspace defaults when adding a SaaS payment method.
 * Gated by `canEditOrgBilling` on the resolved active organization.
 */
export async function getSaaSBillingSetupPrefill(): Promise<
  | { ok: true; stripeOverlay: Partial<SaasSubscriptionBillingFormValues> | null }
  | { ok: false; error: string }
> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: true, stripeOverlay: null }
  }
  const stripe = getStripe()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in to continue." }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) return { ok: false, error: resolved.error }

  const gate = await requireOrgPermissionForServerAction(resolved.organizationId, "canEditOrgBilling")
  if (!gate.ok) return { ok: false, error: gate.error }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error:
        msg.includes("SUPABASE_SERVICE_ROLE_KEY") ?
          "Billing server is not configured (missing SUPABASE_SERVICE_ROLE_KEY)."
        : userFacingStripeSaaSBillingError(e, "setup"),
    }
  }

  const organizationId = resolved.organizationId
  const sub = await getOrganizationSubscription(admin, organizationId)
  const stripeCustomerId = normalizeStripeIdColumn(sub?.stripe_customer_id)
  if (!stripeCustomerId) return { ok: true, stripeOverlay: null }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    if (customer.deleted) return { ok: true, stripeOverlay: null }
    const overlay = mapStripeCustomerToPrefill(customer)
    return { ok: true, stripeOverlay: overlay }
  } catch (err) {
    logStripeSaaSBillingFailure("getSaaSBillingSetupPrefill.retrieve", organizationId, err)
    return { ok: true, stripeOverlay: null }
  }
}

/**
 * Updates the subscription Stripe customer's billing details (does not change Supabase org profile).
 */
export async function updateSaaSSubscriptionStripeCustomerBilling(
  billing: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "Payment setup is not available in this environment." }
  }
  const parsed = saasSubscriptionBillingFormSchema.safeParse(billing)
  if (!parsed.success) {
    return { ok: false, error: formatBillingValidationError(parsed) }
  }
  const stripe = getStripe()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, error: "You must be signed in to continue." }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) return { ok: false, error: resolved.error }

  const gate = await requireOrgPermissionForServerAction(resolved.organizationId, "canEditOrgBilling")
  if (!gate.ok) return { ok: false, error: gate.error }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
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
    logStripeSaaSBillingFailure("updateSaaSSubscriptionStripeCustomerBilling.ensureRow", organizationId, e)
    return { ok: false, error: "Could not prepare billing profile. Please try again or contact support." }
  }
  if (!sub) return { ok: false, error: "Could not load subscription for this organization." }

  let stripeCustomerId = normalizeStripeIdColumn(sub.stripe_customer_id)
  if (!stripeCustomerId) {
    return {
      ok: false,
      error:
        "Billing profile is not ready yet. Try saving your payment method again, or choose a plan below to finish setup.",
    }
  }

  try {
    await stripe.customers.update(stripeCustomerId, stripeCustomerParamsFromBilling(parsed.data))
    return { ok: true }
  } catch (err) {
    logStripeSaaSBillingFailure("updateSaaSSubscriptionStripeCustomerBilling.update", organizationId, err)
    await tryClearStaleStripeCustomerId(admin, organizationId, stripeCustomerId, err)
    return { ok: false, error: userFacingStripeSaaSBillingError(err, "setup") }
  }
}

export async function createSetupIntent(
  billing: unknown,
): Promise<{ clientSecret: string | null; error?: string }> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { clientSecret: null, error: "Payment setup is not available in this environment." }
  }
  const parsed = saasSubscriptionBillingFormSchema.safeParse(billing)
  if (!parsed.success) {
    return { clientSecret: null, error: formatBillingValidationError(parsed) }
  }
  const billingValues = parsed.data
  const stripe = getStripe()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { clientSecret: null, error: "You must be signed in to continue." }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) return { clientSecret: null, error: resolved.error }

  const gate = await requireOrgPermissionForServerAction(resolved.organizationId, "canEditOrgBilling")
  if (!gate.ok) return { clientSecret: null, error: gate.error }

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
  const customerParams = stripeCustomerParamsFromBilling(billingValues)

  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        ...customerParams,
        metadata: {
          organization_id: organizationId,
          source: BILLING_SOURCE,
        },
      })

      stripeCustomerId = normalizeStripeIdColumn(customer.id)
      if (!stripeCustomerId) {
        return { clientSecret: null, error: "Could not create a billing profile. Please try again or contact support." }
      }

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
    } catch (err) {
      logStripeSaaSBillingFailure("createSetupIntent.customers.create", organizationId, err)
      return { clientSecret: null, error: userFacingStripeSaaSBillingError(err, "setup") }
    }
  } else {
    try {
      await stripe.customers.update(stripeCustomerId, customerParams)
    } catch (err) {
      logStripeSaaSBillingFailure("createSetupIntent.customers.update", organizationId, err)
      await tryClearStaleStripeCustomerId(admin, organizationId, stripeCustomerId, err)
      return { clientSecret: null, error: userFacingStripeSaaSBillingError(err, "setup") }
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
