"use server"

import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { resolveActiveOrganizationForUser } from "@/lib/billing/resolve-active-organization"
import { getOrganizationSubscription, normalizeStripeIdColumn } from "@/lib/billing/subscriptions"
import { createServerSupabaseClient } from "@/lib/supabase/server"

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

export type StripeBillingSummaryResult =
  | {
      ok: true
      paymentMethod: StripeBillingPaymentMethod | null
      invoices: StripeBillingInvoiceRow[]
    }
  | {
      ok: false
      error: string
      paymentMethod: null
      invoices: []
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
      error: "Stripe is not configured.",
      paymentMethod: null,
      invoices: [],
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "You must be signed in.", paymentMethod: null, invoices: [] }
  }

  const resolved = await resolveActiveOrganizationForUser(supabase, user.id)
  if ("error" in resolved) {
    return { ok: false, error: resolved.error, paymentMethod: null, invoices: [] }
  }

  const sub = await getOrganizationSubscription(supabase, resolved.organizationId)
  const customerId = normalizeStripeIdColumn(sub?.stripe_customer_id ?? null)
  if (!customerId) {
    return { ok: true, paymentMethod: null, invoices: [] }
  }

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })

    if ("deleted" in customer && customer.deleted) {
      return { ok: true, paymentMethod: null, invoices: [] }
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

    return { ok: true, paymentMethod: paymentSummary, invoices }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load billing details from Stripe."
    return { ok: false, error: msg, paymentMethod: null, invoices: [] }
  }
}
