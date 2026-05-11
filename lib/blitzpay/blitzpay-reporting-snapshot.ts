import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type BlitzpayOrgReportingSnapshot = {
  sinceIso: string | null
  grossProcessedVolumeCents: number
  refundedVolumeCents: number
  netCollectedCents: number
  convenienceFeeCollectedCents: number
  estimatedStripeFeesCents: number
  refundedFeesCents: number
  estimatedNetMerchantPayoutCents: number
  onlinePaymentCount: number
  paymentSourceSplit: { customer_portal: number; staff_dashboard: number }
}

/**
 * Lightweight internal aggregates for support / future dashboards (no charts).
 */
export async function fetchBlitzpayOrgReportingSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string | null },
): Promise<BlitzpayOrgReportingSnapshot> {
  assertUuid(organizationId, "organizationId")
  const sinceIso = options?.sinceIso?.trim() ? options.sinceIso.trim() : null

  let gross = 0
  {
    let q = admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("entry_type", "payment_captured")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    gross = (data ?? []).reduce((s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)), 0)
  }

  let refunded = 0
  {
    let q = admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("entry_type", "refund")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    refunded = (data ?? []).reduce((s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)), 0)
  }

  let convenienceFeeCollectedCents = 0
  let estimatedStripeFeesCents = 0
  let refundedFeesCents = 0
  let onlinePaymentCount = 0
  {
    let q = admin.from("org_invoice_payments").select("id, reference").eq("organization_id", organizationId)
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ reference?: string | null }>
    const blitzRows = rows.filter((r) => String(r.reference ?? "").startsWith("blitzpay_pi:"))
    onlinePaymentCount = blitzRows.length
    if (blitzRows.length > 0) {
      const piIds = blitzRows
        .map((r) => String(r.reference ?? ""))
        .map((ref) => ref.replace(/^blitzpay_pi:/, ""))
        .filter((id) => id.startsWith("pi_"))
      if (piIds.length > 0) {
        const { data: pis, error: piErr } = await admin
          .from("blitzpay_payment_intents")
          .select("stripe_payment_intent_id, amount_cents, convenience_fee_cents")
          .eq("organization_id", organizationId)
          .in("stripe_payment_intent_id", piIds)
        if (piErr) throw new Error(piErr.message)
        for (const p of (pis ?? []) as Array<{ amount_cents: string | number; convenience_fee_cents: string | number }>) {
          const amt = Math.max(0, Math.round(Number(p.amount_cents)))
          const conv = Math.max(0, Math.round(Number(p.convenience_fee_cents)))
          convenienceFeeCollectedCents += conv
          estimatedStripeFeesCents += Math.round(amt * 0.029) + 30
        }
      }
    }
  }

  refundedFeesCents = Math.min(estimatedStripeFeesCents, Math.round(refunded * 0.029))

  let portalCompleted = 0
  let staffCompleted = 0
  {
    let q = admin
      .from("blitzpay_invoice_payment_attempts")
      .select("channel, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const ch = String((r as { channel: string }).channel || "")
      if (ch === "portal_link") portalCompleted += 1
      else staffCompleted += 1
    }
  }

  return {
    sinceIso,
    grossProcessedVolumeCents: gross,
    refundedVolumeCents: refunded,
    netCollectedCents: Math.max(0, gross - refunded),
    convenienceFeeCollectedCents,
    estimatedStripeFeesCents,
    refundedFeesCents,
    estimatedNetMerchantPayoutCents: Math.max(0, gross - refunded - estimatedStripeFeesCents + refundedFeesCents),
    onlinePaymentCount,
    paymentSourceSplit: {
      customer_portal: portalCompleted,
      staff_dashboard: staffCompleted,
    },
  }
}
