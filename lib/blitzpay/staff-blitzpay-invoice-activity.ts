import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type StaffBlitzpayAttemptActivityItem = {
  attemptNo: number
  /** staff_dashboard | customer_portal */
  paymentSource: "staff_dashboard" | "customer_portal"
  /** pending | succeeded | failed | canceled | expired */
  displayStatus: "pending" | "succeeded" | "failed" | "canceled" | "expired"
  attemptStatusRaw: string
  failureCode: string | null
  createdAt: string
  amountCents: number | null
  currency: string | null
  /** Internal FK for staff actions (e.g. receipt resend); not shown to portal customers. */
  blitzpayPaymentIntentId: string | null
  /** Last 6 chars of Stripe PaymentIntent id for support correlation — not a full secret */
  stripePiTail: string | null
  /** Last 8 chars of Checkout Session id when present */
  checkoutSessionTail: string | null
}

function mapAttemptToDisplayStatus(row: {
  status: string
  failure_code?: string | null
}): StaffBlitzpayAttemptActivityItem["displayStatus"] {
  const st = String(row.status || "").toLowerCase()
  if (st === "completed") return "succeeded"
  if (st === "failed") return "failed"
  if (st === "expired" && String(row.failure_code ?? "").toLowerCase() === "canceled") return "canceled"
  if (st === "expired") return "expired"
  if (st === "redirected" || st === "initiated") return "pending"
  return "pending"
}

function paymentSourceFromChannel(channel: string): "staff_dashboard" | "customer_portal" {
  return channel === "portal_link" ? "customer_portal" : "staff_dashboard"
}

function tailFromStripeId(id: string | null | undefined, n: number): string | null {
  const s = String(id ?? "").trim()
  if (s.length < n) return null
  return s.slice(-n)
}

export async function fetchStaffBlitzpayInvoiceAttemptActivity(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
  limit = 30,
): Promise<StaffBlitzpayAttemptActivityItem[]> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")

  const { data: attempts, error: aErr } = await admin
    .from("blitzpay_invoice_payment_attempts")
    .select("attempt_no, channel, status, failure_code, created_at, blitzpay_payment_intent_id")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (aErr) throw new Error(aErr.message)
  const rows = (attempts ?? []) as Array<{
    attempt_no: number
    channel: string
    status: string
    failure_code?: string | null
    created_at: string
    blitzpay_payment_intent_id: string | null
  }>

  const piIds = [...new Set(rows.map((r) => r.blitzpay_payment_intent_id).filter(Boolean))] as string[]
  let piMap = new Map<
    string,
    { amount_cents: string; currency: string; stripe_payment_intent_id: string; stripe_checkout_session_id: string | null }
  >()
  if (piIds.length > 0) {
    const { data: pis, error: pErr } = await admin
      .from("blitzpay_payment_intents")
      .select("id, amount_cents, currency, stripe_payment_intent_id, stripe_checkout_session_id")
      .eq("organization_id", organizationId)
      .in("id", piIds)
    if (pErr) throw new Error(pErr.message)
    for (const p of (pis ?? []) as Array<{
      id: string
      amount_cents: string
      currency: string
      stripe_payment_intent_id: string
      stripe_checkout_session_id: string | null
    }>) {
      piMap.set(p.id, p)
    }
  }

  return rows.map((r) => {
    const pi = r.blitzpay_payment_intent_id ? piMap.get(r.blitzpay_payment_intent_id) : undefined
    const amountCents = pi?.amount_cents != null ? Math.round(Number(pi.amount_cents)) : null
    return {
      attemptNo: r.attempt_no,
      paymentSource: paymentSourceFromChannel(r.channel),
      displayStatus: mapAttemptToDisplayStatus({ status: r.status, failure_code: r.failure_code }),
      attemptStatusRaw: r.status,
      failureCode: r.failure_code ?? null,
      createdAt: r.created_at,
      amountCents,
      currency: pi?.currency?.trim()?.toLowerCase() ?? null,
      blitzpayPaymentIntentId: r.blitzpay_payment_intent_id,
      stripePiTail: tailFromStripeId(pi?.stripe_payment_intent_id, 6),
      checkoutSessionTail: tailFromStripeId(pi?.stripe_checkout_session_id ?? undefined, 8),
    }
  })
}
