import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type BlitzpayInvoicePhase2kDashboard = {
  partialPayments: {
    orgEnabled: boolean
    platformAllowed: boolean
    effective: boolean
    minCents: number
  }
  scheduledPaymentsEnabled: boolean
  savedPaymentProfile: boolean
  autopayAuthorization: {
    status: "none" | "active" | "revoked"
    methodType: string | null
    consentAt: string | null
    revokedAt: string | null
  }
  scheduled: Array<{
    id: string
    scheduledFor: string
    invoicePortionCents: number
    status: string
    createdByKind: string
  }>
  blitzpayPartialPaymentHistory: Array<{
    paidOn: string
    amountCents: number
    referenceDisplay: string | null
  }>
}

export async function fetchBlitzpayInvoicePhase2kDashboard(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  customerId: string,
): Promise<BlitzpayInvoicePhase2kDashboard> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  assertUuid(customerId, "customerId")

  const [{ data: settings }, { data: profile }, { data: schedules }, { data: payments }] = await Promise.all([
    admin
      .from("blitzpay_org_settings")
      .select(
        "blitzpay_partial_payments_enabled, blitzpay_partial_payment_min_cents, blitzpay_platform_partial_payments_allowed, blitzpay_scheduled_payments_enabled",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("blitzpay_customer_payment_profiles")
      .select(
        "stripe_customer_id, autopay_authorization_status, autopay_authorized_method_type, autopay_consent_at, autopay_revoked_at, off_session_authorized",
      )
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    admin
      .from("blitzpay_scheduled_invoice_payments")
      .select("id, scheduled_for, invoice_portion_cents, status, created_by_kind")
      .eq("organization_id", organizationId)
      .eq("org_invoice_id", invoiceId)
      .in("status", ["pending", "processing"])
      .order("scheduled_for", { ascending: true })
      .limit(20),
    admin
      .from("org_invoice_payments")
      .select("amount_cents, paid_on, reference")
      .eq("organization_id", organizationId)
      .eq("invoice_id", invoiceId)
      .like("reference", "blitzpay_pi:%")
      .order("paid_on", { ascending: false })
      .limit(25),
  ])

  const s = settings as {
    blitzpay_partial_payments_enabled?: boolean
    blitzpay_partial_payment_min_cents?: number
    blitzpay_platform_partial_payments_allowed?: boolean
    blitzpay_scheduled_payments_enabled?: boolean
  } | null

  const orgEnabled = Boolean(s?.blitzpay_partial_payments_enabled)
  const platformAllowed = s?.blitzpay_platform_partial_payments_allowed !== false
  const minCents = Math.max(50, Math.round(Number(s?.blitzpay_partial_payment_min_cents ?? 50)))
  const scheduledPaymentsEnabled = s?.blitzpay_scheduled_payments_enabled !== false

  const p = profile as {
    stripe_customer_id?: string | null
    autopay_authorization_status?: string
    autopay_authorized_method_type?: string | null
    autopay_consent_at?: string | null
    autopay_revoked_at?: string | null
    off_session_authorized?: boolean
  } | null

  const st = (p?.autopay_authorization_status ?? "none") as "none" | "active" | "revoked"
  const savedPaymentProfile = Boolean(p?.stripe_customer_id?.trim())

  return {
    partialPayments: {
      orgEnabled,
      platformAllowed,
      effective: platformAllowed && orgEnabled,
      minCents,
    },
    scheduledPaymentsEnabled,
    savedPaymentProfile,
    autopayAuthorization: {
      status: st === "active" || st === "revoked" ? st : "none",
      methodType: p?.autopay_authorized_method_type ?? null,
      consentAt: p?.autopay_consent_at ?? null,
      revokedAt: p?.autopay_revoked_at ?? null,
    },
    scheduled: (schedules ?? []).map((r) => {
      const row = r as {
        id: string
        scheduled_for: string
        invoice_portion_cents: number
        status: string
        created_by_kind: string
      }
      return {
        id: row.id,
        scheduledFor: row.scheduled_for,
        invoicePortionCents: Math.round(Number(row.invoice_portion_cents)),
        status: row.status,
        createdByKind: row.created_by_kind,
      }
    }),
    blitzpayPartialPaymentHistory: (payments ?? []).map((r) => {
      const row = r as { amount_cents: number; paid_on: string; reference: string | null }
      const ref = String(row.reference ?? "")
      const tail = ref.startsWith("blitzpay_pi:") ? ref.slice(-10) : ref
      return {
        paidOn: row.paid_on,
        amountCents: Math.round(Number(row.amount_cents)),
        referenceDisplay: tail || null,
      }
    }),
  }
}
