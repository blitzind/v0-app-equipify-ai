"use server"

import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
import { getOrganizationSubscription, normalizeStripeIdColumn } from "@/lib/billing/subscriptions"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  logStripeSaaSBillingFailure,
  tryClearStaleStripeCustomerId,
  userFacingStripeSaaSBillingError,
} from "@/lib/billing/stripe-saas-billing-errors"

export type StripeBillingPaymentMethod = {
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
}

export type StripeBillingInvoiceRow = {
  id: string
  number: string | null
  created: string
  amountPaid: number
  amountDue: number
  currency: string
  status: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

/** Optional Stripe subscription instants (ISO) for billing UI when the DB row lags webhooks. */
export type StripeBillingScheduleDates = {
  trialEndIso: string | null
  currentPeriodEndIso: string | null
}

export type StripeBillingSummaryResult =
  | {
      ok: true
      paymentMethod: StripeBillingPaymentMethod | null
      invoices: StripeBillingInvoiceRow[]
      scheduleDates: StripeBillingScheduleDates
    }
  | {
      ok: false
      error: string
      paymentMethod: null
      invoices: []
      scheduleDates: null
    }

function paymentMethodToSummary(pm: Stripe.PaymentMethod): StripeBillingPaymentMethod | null {
  if (pm.type === "card" && pm.card) {
    return {
      brand: pm.card.brand ?? null,
      last4: pm.card.last4 ?? null,
      expMonth: pm.card.exp_month ?? null,
      expYear: pm.card.exp_year ?? null,
    }
  }
  return null
}

function invoiceToRow(inv: Stripe.Invoice): StripeBillingInvoiceRow {
  return {
    id: inv.id,
    number: inv.number ?? null,
    created: new Date(inv.created * 1000).toISOString(),
    amountPaid: inv.amount_paid ?? 0,
    amountDue: inv.amount_due ?? 0,
    currency: inv.currency ?? "usd",
    status: inv.status ?? null,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
  }
}

/**
 * Sanitized Stripe billing snapshot for the active org (payment method + invoices).
 * Customer objects are never returned—only derived fields.
 */
export async function getStripeBillingSummary(): Promise<StripeBillingSummaryResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      error: "Saved payment details are not available in this environment.",
      paymentMethod: null,
      invoices: [],
      scheduleDates: null,
    }
  }

  const stripe = getStripe()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "You must be signed in.", paymentMethod: null, invoices: [], scheduleDates: null }
  }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) {
    return { ok: false, error: resolved.error, paymentMethod: null, invoices: [], scheduleDates: null }
  }

  const sub = await getOrganizationSubscription(supabase, resolved.organizationId)
  const customerId = normalizeStripeIdColumn(sub?.stripe_customer_id ?? null)
  if (!customerId) {
    return {
      ok: true,
      paymentMethod: null,
      invoices: [],
      scheduleDates: { trialEndIso: null, currentPeriodEndIso: null },
    }
  }

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })

    if ("deleted" in customer && customer.deleted) {
      return {
        ok: true,
        paymentMethod: null,
        invoices: [],
        scheduleDates: { trialEndIso: null, currentPeriodEndIso: null },
      }
    }

    let paymentSummary: StripeBillingPaymentMethod | null = null
    const rawDefault = customer.invoice_settings?.default_payment_method
    let pmId: string | null = null
    if (typeof rawDefault === "string") {
      pmId = normalizeStripeIdColumn(rawDefault)
    } else if (rawDefault && typeof rawDefault === "object" && "id" in rawDefault) {
      pmId = (rawDefault as Stripe.PaymentMethod).id
    }

    if (pmId) {
      const pm = await stripe.paymentMethods.retrieve(pmId)
      paymentSummary = paymentMethodToSummary(pm)
    }

    if (!paymentSummary) {
      const list = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 3,
      })
      for (const pm of list.data) {
        paymentSummary = paymentMethodToSummary(pm)
        if (paymentSummary) break
      }
    }

    const invList = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
    })

    const invoices = invList.data.map(invoiceToRow)

    let scheduleDates: StripeBillingScheduleDates = { trialEndIso: null, currentPeriodEndIso: null }
    const stripeSubId = normalizeStripeIdColumn(sub?.stripe_subscription_id ?? null)
    if (stripeSubId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)
        if (typeof stripeSub !== "string" && !stripeSub.deleted) {
          scheduleDates = {
            trialEndIso: stripeSub.trial_end
              ? new Date(stripeSub.trial_end * 1000).toISOString()
              : null,
            currentPeriodEndIso: stripeSub.current_period_end
              ? new Date(stripeSub.current_period_end * 1000).toISOString()
              : null,
          }
        }
      } catch (scheduleErr) {
        logStripeSaaSBillingFailure("getStripeBillingSummary.scheduleDates", resolved.organizationId, scheduleErr)
      }
    }

    return { ok: true, paymentMethod: paymentSummary, invoices, scheduleDates }
  } catch (e) {
    logStripeSaaSBillingFailure("getStripeBillingSummary", resolved.organizationId, e)
    try {
      const admin = createServiceRoleSupabaseClient()
      const cleared = await tryClearStaleStripeCustomerId(admin, resolved.organizationId, customerId, e)
      if (cleared) {
        return {
          ok: true,
          paymentMethod: null,
          invoices: [],
          scheduleDates: { trialEndIso: null, currentPeriodEndIso: null },
        }
      }
    } catch {
      /* service role unavailable — fall through to friendly error */
    }
    return {
      ok: false,
      error: userFacingStripeSaaSBillingError(e, "payment_details"),
      paymentMethod: null,
      invoices: [],
      scheduleDates: null,
    }
  }
}
