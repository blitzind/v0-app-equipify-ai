import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { addMonths, addWeeks, addYears, subDays } from "date-fns"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  buildRetentionRecommendationLines,
  churnRiskScore0to100 as membershipChurnComposite0to100,
  scoreMembershipHealthFromSignals,
} from "@/lib/blitzpay/blitzpay-membership-health"

export const MEMBERSHIP_LIST_CAP = 500
export const MEMBERSHIP_DUE_SCAN_CAP = 40
export const MEMBERSHIP_SNAPSHOT_ORG_CAP = 120
export const MEMBERSHIP_OPEN_INVOICE_SCAN_CAP = 80

export type BlitzpayMembershipRow = {
  id: string
  organization_id: string
  customer_id: string
  maintenance_plan_id: string | null
  work_order_template_id: string | null
  membership_number: string
  status: string
  billing_frequency: string
  billing_anchor_date: string
  next_invoice_at: string | null
  next_work_order_at: string | null
  auto_renew: boolean
  auto_bill_enabled: boolean
  default_payment_method_profile_id: string | null
  recurring_amount_cents: number
  renewal_notice_days: number
  started_at: string
  expires_at: string | null
  canceled_at: string | null
  cancellation_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type BlitzpayMembershipDashboard = {
  activeCount: number
  pausedCount: number
  delinquentCount: number
  canceledWindowCount: number
  mrrCents: number
  arrCents: number
  renewalPipelineCents: number
  delinquentExposureCents: number
  autopayAdoptionPct: number
  churnRiskScore0to100: number
  openFailureCount: number
  recoveredFailureWindowCount: number
  deferredRevenueProxyCents: number
  /** Deterministic lines for UI (no LLM). */
  insightLines: string[]
}

function monthlyEquivalentCents(frequency: string, recurringCents: number): number {
  const c = Math.max(0, Math.round(recurringCents))
  const f = String(frequency || "").toLowerCase()
  if (f === "weekly") return Math.round((c * 52) / 12)
  if (f === "monthly") return c
  if (f === "quarterly") return Math.round(c / 3)
  if (f === "annual") return Math.round(c / 12)
  return c
}

export async function fetchBlitzpayMembershipDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayMembershipDashboard> {
  assertUuid(organizationId, "organizationId")
  const { data: rows, error } = await admin
    .from("blitzpay_memberships")
    .select(
      "id, status, billing_frequency, recurring_amount_cents, auto_bill_enabled, next_invoice_at, expires_at, canceled_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MEMBERSHIP_LIST_CAP)
  if (error) throw new Error(error.message)
  const list = (rows ?? []) as Array<{
    id: string
    status: string
    billing_frequency: string
    recurring_amount_cents: number
    auto_bill_enabled: boolean
    next_invoice_at: string | null
    expires_at: string | null
    canceled_at: string | null
  }>
  let activeCount = 0
  let pausedCount = 0
  let delinquentCount = 0
  let canceledWindowCount = 0
  let mrrAccum = 0
  let autopayOn = 0
  let renewalPipelineCents = 0
  let delinquentExposureCents = 0
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
  for (const r of list) {
    const st = String(r.status || "").toLowerCase()
    if (st === "active") {
      activeCount += 1
      mrrAccum += monthlyEquivalentCents(r.billing_frequency, r.recurring_amount_cents)
      if (r.auto_bill_enabled) autopayOn += 1
      if (r.next_invoice_at) {
        const t = Date.parse(r.next_invoice_at)
        if (Number.isFinite(t) && t <= Date.now() + 90 * 86400_000) {
          renewalPipelineCents += Math.max(0, Math.round(Number(r.recurring_amount_cents)))
        }
      }
    } else if (st === "paused") pausedCount += 1
    else if (st === "delinquent") {
      delinquentCount += 1
      delinquentExposureCents += Math.max(0, Math.round(Number(r.recurring_amount_cents)))
    } else if (st === "canceled" && r.canceled_at && r.canceled_at >= since30) {
      canceledWindowCount += 1
    }
  }
  const autopayAdoptionPct =
    activeCount > 0 ? Math.min(100, Math.round((autopayOn / activeCount) * 1000) / 10) : 0

  let openFailureCount = 0
  let recoveredFailureWindowCount = 0
  {
    const { data: fails, error: fErr } = await admin
      .from("blitzpay_membership_payment_failures")
      .select("id, recovery_status, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200)
    if (!fErr && fails?.length) {
      for (const f of fails as Array<{ recovery_status: string; updated_at: string }>) {
        if (String(f.recovery_status) === "open") openFailureCount += 1
        if (String(f.recovery_status) === "recovered" && f.updated_at >= since30) recoveredFailureWindowCount += 1
      }
    }
  }

  let deferredRevenueProxyCents = 0
  {
    const { data: links, error: lErr } = await admin
      .from("blitzpay_membership_invoices")
      .select("org_invoice_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(MEMBERSHIP_OPEN_INVOICE_SCAN_CAP)
    if (!lErr && links?.length) {
      const ids = (links as Array<{ org_invoice_id: string }>).map((x) => x.org_invoice_id)
      const chunk = 40
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk)
        const { data: invs, error: iErr } = await admin
          .from("org_invoices")
          .select("id, amount_cents, tax_amount_cents, status")
          .eq("organization_id", organizationId)
          .in("id", slice)
          .in("status", ["sent", "unpaid", "overdue"])
        if (iErr) continue
        for (const inv of invs ?? []) {
          const row = inv as { amount_cents: number; tax_amount_cents: number | null }
          deferredRevenueProxyCents += Math.max(
            0,
            Math.round(Number(row.amount_cents)) + Math.max(0, Math.round(Number(row.tax_amount_cents ?? 0))),
          )
        }
      }
    }
  }

  const customersMissingAutopay = Math.max(0, activeCount - autopayOn)
  const health = scoreMembershipHealthFromSignals({
    failedScheduledWindowCount: openFailureCount,
    overdueOpenInvoiceCountForCohort: delinquentCount,
    activeMaintenanceWithoutAutopay: customersMissingAutopay >= 2 && activeCount >= 2,
    contractExpiring30d: false,
    financingHeavy: false,
    disputePressure: delinquentExposureCents > 25_000_00,
  })
  const churnRiskScore0to100 = membershipChurnComposite0to100({
    failedScheduledWindowCount: openFailureCount,
    failedExposureCents: delinquentExposureCents,
    overdueInvoiceCount: delinquentCount,
    customersMissingAutopayWithActivePlans: customersMissingAutopay,
    expiredContractDataRiskCount: 0,
  })

  const lines: string[] = []
  lines.push(`${activeCount} active memberships · MRR proxy ${(mrrAccum / 100).toFixed(0)} USD equivalent.`)
  if (delinquentCount > 0) lines.push(`${delinquentCount} delinquent memberships — prioritize collections before next cycle.`)
  if (autopayAdoptionPct < 45 && activeCount >= 3) {
    lines.push(`Autopilot coverage is ${autopayAdoptionPct.toFixed(0)}% — turning on auto-bill reduces missed renewals.`)
  }
  lines.push(
    ...buildRetentionRecommendationLines({
      customersMissingAutopayWithActivePlans: customersMissingAutopay,
      failedScheduledWindowCount: openFailureCount,
      contractExpiring30dCount: 0,
      churnRiskScore0to100,
    }).slice(0, 4),
  )
  if (health.drivers.length) {
    lines.push(`Health drivers: ${health.drivers.slice(0, 4).join(", ")}.`)
  }

  return {
    activeCount,
    pausedCount,
    delinquentCount,
    canceledWindowCount,
    mrrCents: mrrAccum,
    arrCents: mrrAccum * 12,
    renewalPipelineCents,
    delinquentExposureCents,
    autopayAdoptionPct,
    churnRiskScore0to100,
    openFailureCount,
    recoveredFailureWindowCount,
    deferredRevenueProxyCents,
    insightLines: lines,
  }
}

export type BlitzpayMembershipReportingSlice = {
  recurringRevenueCents: number
  annualRecurringRevenueCents: number
  delinquentMembershipRevenueCents: number
  renewalPipelineCents: number
  recoveredMembershipRevenueCents: number
  membershipAutoPayAdoptionBasisPoints: number
  churnRiskRevenueCents: number
}

export async function fetchBlitzpayMembershipReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayMembershipReportingSlice> {
  const dash = await fetchBlitzpayMembershipDashboard(admin, organizationId)
  return {
    recurringRevenueCents: dash.mrrCents,
    annualRecurringRevenueCents: dash.arrCents,
    delinquentMembershipRevenueCents: dash.delinquentExposureCents,
    renewalPipelineCents: dash.renewalPipelineCents,
    recoveredMembershipRevenueCents: Math.min(dash.renewalPipelineCents, dash.recoveredFailureWindowCount * 50_00),
    membershipAutoPayAdoptionBasisPoints: Math.round(dash.autopayAdoptionPct * 100),
    churnRiskRevenueCents: Math.min(dash.renewalPipelineCents, Math.round(dash.churnRiskScore0to100 * dash.mrrCents * 0.01)),
  }
}

export async function fetchMembershipInvoiceTag(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<{ membershipId: string; membershipNumber: string } | null> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const { data: link, error } = await admin
    .from("blitzpay_membership_invoices")
    .select("membership_id")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .maybeSingle()
  if (error || !link) return null
  const membershipId = (link as { membership_id: string }).membership_id
  const { data: m, error: mErr } = await admin
    .from("blitzpay_memberships")
    .select("membership_number")
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .maybeSingle()
  if (mErr || !m) return { membershipId, membershipNumber: membershipId.slice(0, 8) }
  return { membershipId, membershipNumber: String((m as { membership_number: string }).membership_number) }
}

export async function insertMembershipEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    membershipId: string
    eventType: string
    eventSummary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.membershipId, "membershipId")
  const { error } = await admin.from("blitzpay_membership_events").insert({
    organization_id: input.organizationId,
    membership_id: input.membershipId,
    event_type: input.eventType,
    event_summary: input.eventSummary,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export function computeBillingPeriodEndUtc(periodStartYmd: string, frequency: string): string {
  const start = new Date(`${periodStartYmd}T12:00:00Z`)
  const f = String(frequency || "").toLowerCase()
  let endBase = start
  if (f === "weekly") endBase = addWeeks(start, 1)
  else if (f === "monthly") endBase = addMonths(start, 1)
  else if (f === "quarterly") endBase = addMonths(start, 3)
  else if (f === "annual") endBase = addYears(start, 1)
  else endBase = addMonths(start, 1)
  const end = subDays(endBase, 1)
  return end.toISOString().slice(0, 10)
}

export async function listBlitzpayMemberships(
  admin: SupabaseClient,
  organizationId: string,
  filter?: { customerId?: string },
): Promise<BlitzpayMembershipRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_memberships")
    .select(
      "id, organization_id, customer_id, maintenance_plan_id, work_order_template_id, membership_number, status, billing_frequency, billing_anchor_date, next_invoice_at, next_work_order_at, auto_renew, auto_bill_enabled, default_payment_method_profile_id, recurring_amount_cents, renewal_notice_days, started_at, expires_at, canceled_at, cancellation_reason, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MEMBERSHIP_LIST_CAP)
  if (filter?.customerId) {
    assertUuid(filter.customerId, "customerId")
    q = q.eq("customer_id", filter.customerId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as BlitzpayMembershipRow[]
}

export async function getBlitzpayMembershipById(
  admin: SupabaseClient,
  organizationId: string,
  membershipId: string,
): Promise<BlitzpayMembershipRow | null> {
  assertUuid(organizationId, "organizationId")
  assertUuid(membershipId, "membershipId")
  const { data, error } = await admin
    .from("blitzpay_memberships")
    .select(
      "id, organization_id, customer_id, maintenance_plan_id, work_order_template_id, membership_number, status, billing_frequency, billing_anchor_date, next_invoice_at, next_work_order_at, auto_renew, auto_bill_enabled, default_payment_method_profile_id, recurring_amount_cents, renewal_notice_days, started_at, expires_at, canceled_at, cancellation_reason, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BlitzpayMembershipRow) ?? null
}

export async function createBlitzpayMembership(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    membershipNumber?: string
    maintenancePlanId?: string | null
    workOrderTemplateId?: string | null
    billingFrequency: string
    billingAnchorDate: string
    recurringAmountCents: number
    autoRenew?: boolean
    autoBillEnabled?: boolean
    defaultPaymentMethodProfileId?: string | null
    renewalNoticeDays?: number
    expiresAt?: string | null
  },
): Promise<{ id: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  const num =
    input.membershipNumber?.trim() ||
    `MP-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`
  const freq = String(input.billingFrequency || "").toLowerCase()
  if (!["weekly", "monthly", "quarterly", "annual"].includes(freq)) {
    throw new Error("Invalid billing_frequency")
  }
  const anchor = String(input.billingAnchorDate).slice(0, 10)
  const nextStart = anchor
  const nextIso = new Date(`${nextStart}T15:00:00.000Z`).toISOString()
  const row = {
    organization_id: input.organizationId,
    customer_id: input.customerId,
    maintenance_plan_id: input.maintenancePlanId ?? null,
    work_order_template_id: input.workOrderTemplateId ?? null,
    membership_number: num,
    billing_frequency: freq,
    billing_anchor_date: anchor,
    next_invoice_at: nextIso,
    next_work_order_at: null as string | null,
    auto_renew: input.autoRenew ?? true,
    auto_bill_enabled: input.autoBillEnabled ?? false,
    default_payment_method_profile_id: input.defaultPaymentMethodProfileId ?? null,
    recurring_amount_cents: Math.max(0, Math.round(Number(input.recurringAmountCents))),
    renewal_notice_days: input.renewalNoticeDays ?? 14,
    expires_at: input.expiresAt ?? null,
    status: "active",
    metadata: {},
  }
  const { data, error } = await admin.from("blitzpay_memberships").insert(row).select("id").maybeSingle()
  if (error) throw new Error(error.message)
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error("membership_create_failed")
  await insertMembershipEvent(admin, {
    organizationId: input.organizationId,
    membershipId: id,
    eventType: "created",
    eventSummary: "Membership created.",
    metadata: { membership_number: num },
  })
  return { id }
}

export async function patchBlitzpayMembership(
  admin: SupabaseClient,
  organizationId: string,
  membershipId: string,
  patch: Partial<{
    status: string
    recurring_amount_cents: number
    auto_bill_enabled: boolean
    auto_renew: boolean
    next_invoice_at: string | null
    default_payment_method_profile_id: string | null
    renewal_notice_days: number
    expires_at: string | null
  }>,
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  assertUuid(membershipId, "membershipId")
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.recurring_amount_cents !== undefined) row.recurring_amount_cents = Math.max(0, Math.round(patch.recurring_amount_cents))
  if (patch.auto_bill_enabled !== undefined) row.auto_bill_enabled = patch.auto_bill_enabled
  if (patch.auto_renew !== undefined) row.auto_renew = patch.auto_renew
  if (patch.next_invoice_at !== undefined) row.next_invoice_at = patch.next_invoice_at
  if (patch.default_payment_method_profile_id !== undefined) {
    row.default_payment_method_profile_id = patch.default_payment_method_profile_id
  }
  if (patch.renewal_notice_days !== undefined) row.renewal_notice_days = patch.renewal_notice_days
  if (patch.expires_at !== undefined) row.expires_at = patch.expires_at
  const { error } = await admin.from("blitzpay_memberships").update(row).eq("id", membershipId).eq("organization_id", organizationId)
  if (error) throw new Error(error.message)
}

export async function fetchBlitzpayMembershipRetentionReport(
  admin: SupabaseClient,
  organizationId: string,
): Promise<
  Array<{
    snapshot_date: string
    active_memberships: number
    mrr_cents: number
    delinquent_memberships: number
  }>
> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_membership_retention_snapshots")
    .select("snapshot_date, active_memberships, mrr_cents, delinquent_memberships")
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false })
    .limit(45)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    snapshot_date: string
    active_memberships: number
    mrr_cents: number
    delinquent_memberships: number
  }>
}

export function nextBillingPeriodStartYmd(periodStartYmd: string, frequency: string): string {
  const start = new Date(`${periodStartYmd}T12:00:00Z`)
  const f = String(frequency || "").toLowerCase()
  if (f === "weekly") return addWeeks(start, 1).toISOString().slice(0, 10)
  if (f === "monthly") return addMonths(start, 1).toISOString().slice(0, 10)
  if (f === "quarterly") return addMonths(start, 3).toISOString().slice(0, 10)
  if (f === "annual") return addYears(start, 1).toISOString().slice(0, 10)
  return addMonths(start, 1).toISOString().slice(0, 10)
}
