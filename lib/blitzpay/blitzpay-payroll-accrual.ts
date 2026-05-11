import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { invoiceGrandTotalCents } from "@/lib/billing/invoice-payment-allocation"
import {
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import {
  calculateTechnicianCommission,
  calculateWorkOrderRevenueBasis,
  type TechnicianCompensationProfileLike,
  type TechnicianCompensationType,
} from "@/lib/blitzpay/blitzpay-payroll-engine"
import { assertUuid, blitzpayRevenueShareLedgerKeyV1 } from "@/lib/blitzpay/idempotency-keys"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WO_LINK_CAP = 8
const RULE_CAP = 50

function mapCompType(raw: string | null | undefined): TechnicianCompensationType {
  const s = String(raw || "").toLowerCase()
  if (s === "hourly" || s === "salary" || s === "commission" || s === "hybrid") return s
  return "commission"
}

async function resolveWorkOrderIdForInvoice(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  invoiceWorkOrderId: string | null | undefined,
): Promise<string | null> {
  if (invoiceWorkOrderId && String(invoiceWorkOrderId).length > 0) return String(invoiceWorkOrderId)
  const { data, error } = await admin
    .from("invoice_work_order_links")
    .select("work_order_id")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .limit(WO_LINK_CAP)
  if (error) throw new Error(error.message)
  const first = (data ?? [])[0] as { work_order_id?: string } | undefined
  return first?.work_order_id ? String(first.work_order_id) : null
}

async function loadActiveTechnicianProfile(
  admin: SupabaseClient,
  organizationId: string,
  technicianUserId: string,
): Promise<TechnicianCompensationProfileLike | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from("blitzpay_technician_compensation_profiles")
    .select(
      "compensation_type, commission_percentage, flat_rate_cents, overtime_multiplier, active, effective_from, effective_to",
    )
    .eq("organization_id", organizationId)
    .eq("technician_user_id", technicianUserId)
    .eq("active", true)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(8)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{
    compensation_type: string
    commission_percentage: string | number
    flat_rate_cents: number
    overtime_multiplier: string | number
    effective_to?: string | null
  }>
  const picked =
    rows.find((r) => !r.effective_to || String(r.effective_to).slice(0, 10) >= today) ?? rows[0]
  if (!picked) return null
  return {
    compensationType: mapCompType(picked.compensation_type),
    commissionPercentage: Number(picked.commission_percentage) || 0,
    flatRateCents: Math.max(0, Math.round(Number(picked.flat_rate_cents) || 0)),
    overtimeMultiplier: Number(picked.overtime_multiplier) || 1,
  }
}

const defaultProfile: TechnicianCompensationProfileLike = {
  compensationType: "commission",
  commissionPercentage: 0,
  flatRateCents: 0,
  overtimeMultiplier: 1,
}

/**
 * Idempotent accrual refresh after invoice collection changes (webhook, wallet apply, manual payments).
 * Bounded reads; no Stripe identifiers stored on new rows.
 */
export async function syncBlitzpayPayrollAccrualForOrgInvoice(
  admin: SupabaseClient,
  input: { organizationId: string; orgInvoiceId: string },
): Promise<void> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")

  const inv = await loadInvoiceForBlitzpayPay(admin, input.organizationId, input.orgInvoiceId)
  if (!inv) return

  const netPaid = await sumNetRecordedPaymentsCentsForBlitzpay(admin, input.organizationId, input.orgInvoiceId)
  const grandTotal = invoiceGrandTotalCents({
    amount_cents: Number(inv.amount_cents) || 0,
    tax_amount_cents: inv.tax_amount_cents == null ? null : Number(inv.tax_amount_cents),
  })
  const revenueBasis = calculateWorkOrderRevenueBasis({
    invoiceGrandTotalCents: grandTotal,
    netPaidCents: netPaid,
    depositDoubleCountOverlapCents: 0,
  })

  const woId = await resolveWorkOrderIdForInvoice(admin, input.organizationId, input.orgInvoiceId, inv.work_order_id ?? null)

  let technicianUserId: string | null = null
  if (woId) {
    const { data: wo, error: woErr } = await admin
      .from("work_orders")
      .select("assigned_user_id")
      .eq("organization_id", input.organizationId)
      .eq("id", woId)
      .maybeSingle()
    if (woErr) throw new Error(woErr.message)
    const aid = (wo as { assigned_user_id?: string | null } | null)?.assigned_user_id
    technicianUserId = aid && String(aid).length > 0 ? String(aid) : null
  }

  if (technicianUserId) {
    const { data: existing, error: exErr } = await admin
      .from("blitzpay_work_order_commissions")
      .select("id, commission_status")
      .eq("organization_id", input.organizationId)
      .eq("org_invoice_id", input.orgInvoiceId)
      .eq("technician_user_id", technicianUserId)
      .maybeSingle()
    if (exErr) throw new Error(exErr.message)
    const st = String((existing as { commission_status?: string } | null)?.commission_status ?? "")
    if (st === "paid" || st === "void") return

    const profile = (await loadActiveTechnicianProfile(admin, input.organizationId, technicianUserId)) ?? defaultProfile
    const commissionCents = calculateTechnicianCommission(revenueBasis, profile)

    const { error: upErr } = await admin.from("blitzpay_work_order_commissions").upsert(
      {
        organization_id: input.organizationId,
        work_order_id: woId,
        org_invoice_id: input.orgInvoiceId,
        technician_user_id: technicianUserId,
        revenue_basis_cents: revenueBasis,
        commission_cents: commissionCents,
        commission_status: st === "approved" ? "approved" : "pending",
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,org_invoice_id,technician_user_id" },
    )
    if (upErr) throw new Error(upErr.message)
  }

  const { data: rules, error: rErr } = await admin
    .from("blitzpay_revenue_share_rules")
    .select("id, rule_type, percentage, applies_to")
    .eq("organization_id", input.organizationId)
    .eq("active", true)
    .limit(RULE_CAP)
  if (rErr) throw new Error(rErr.message)

  const membershipLink = await admin
    .from("blitzpay_membership_invoices")
    .select("membership_id")
    .eq("organization_id", input.organizationId)
    .eq("org_invoice_id", input.orgInvoiceId)
    .maybeSingle()

  let membershipId: string | null = null
  if (!membershipLink.error && membershipLink.data) {
    const mid = (membershipLink.data as { membership_id?: string }).membership_id
    if (mid && UUID_RE.test(String(mid))) membershipId = String(mid)
  }

  for (const rule of (rules ?? []) as Array<{ id: string; rule_type: string; percentage: string | number; applies_to: string }>) {
    const pct = Math.min(100, Math.max(0, Number(rule.percentage) || 0))
    const rt = String(rule.rule_type || "")
    let gross = 0
    let sourceType = "invoice"
    let sourceId = input.orgInvoiceId
    if (rt === "invoice") {
      gross = revenueBasis
    } else if (rt === "work_order" && woId) {
      gross = revenueBasis
      sourceType = "work_order"
      sourceId = woId
    } else if (rt === "membership" && membershipId) {
      sourceType = "membership"
      sourceId = membershipId
      const { data: mem, error: mErr } = await admin
        .from("blitzpay_memberships")
        .select("recurring_amount_cents")
        .eq("organization_id", input.organizationId)
        .eq("id", membershipId)
        .maybeSingle()
      if (mErr) throw new Error(mErr.message)
      const recurring = Math.max(0, Math.round(Number((mem as { recurring_amount_cents?: number } | null)?.recurring_amount_cents ?? 0)))
      gross = Math.min(recurring, revenueBasis)
    } else {
      continue
    }

    const applies = String(rule.applies_to || "all")
    if (applies !== "all" && applies !== input.orgInvoiceId && applies !== (woId ?? "")) continue
    if (gross < 1 || pct <= 0) continue

    const shareCents = Math.round((gross * pct) / 100)
    if (shareCents < 1) continue

    const idem = blitzpayRevenueShareLedgerKeyV1({
      organizationId: input.organizationId,
      ruleId: rule.id,
      sourceType,
      sourceId,
    })

    const { error: insErr } = await admin.from("blitzpay_revenue_share_ledger").upsert(
      {
        organization_id: input.organizationId,
        source_type: sourceType,
        source_id: sourceId,
        recipient_type: "internal",
        recipient_id: null,
        gross_cents: gross,
        share_cents: shareCents,
        status: "pending",
        revenue_share_rule_id: rule.id,
        idempotency_key: idem,
      },
      { onConflict: "organization_id,idempotency_key" },
    )
    if (insErr) throw new Error(insErr.message)
  }
}
