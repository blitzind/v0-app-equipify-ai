import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBlitzpayApInsights, type BlitzpayApInsight } from "@/lib/blitzpay/blitzpay-ap-insights"
import {
  aggregateApObligationBuckets,
  projectedOutgoingCashCents,
  vendorPayoutVelocityPaidCents,
} from "@/lib/blitzpay/blitzpay-ap-math"
import { aggregateBlitzpayTreasuryMetrics, fetchBlitzpayTreasuryDashboard } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { assertValidVendorPayableTransition, isOpenVendorPayableStatus } from "@/lib/blitzpay/blitzpay-payable-lifecycle"
import { utcTodayYmd } from "@/lib/blitzpay/blitzpay-treasury-math"

const PAYABLE_PAGE = 500

export type VendorPayableVendorKind =
  | "vendor"
  | "subcontractor"
  | "field_reimbursement"
  | "equipment_supplier"
  | "material_supplier"

export type VendorPayableListRow = {
  id: string
  vendorKind: VendorPayableVendorKind
  counterpartyLabel: string
  orgVendorId: string | null
  amountCents: number
  currency: string
  dueDate: string
  scheduledPayoutDate: string | null
  paidAt: string | null
  status: string
  approvalNotes: string | null
  approvedByUserId: string | null
  approvedAt: string | null
  requestedByUserId: string | null
  workOrderId: string | null
  orgInvoiceId: string | null
  orgPurchaseOrderId: string | null
  reimbursementFlag: boolean
  materialCostFlag: boolean
  createdAt: string
  updatedAt: string
}

export type VendorExposureRow = {
  counterpartyKey: string
  label: string
  openCents: number
  overdueOpenCents: number
  openCount: number
}

export type BlitzpayApDashboardPayload = {
  todayYmd: string
  payables: VendorPayableListRow[]
  buckets: ReturnType<typeof aggregateApObligationBuckets>
  vendorExposure: VendorExposureRow[]
  treasury: Awaited<ReturnType<typeof fetchBlitzpayTreasuryDashboard>>
  apProjectedOutgoingCents7d: number
  vendorPayoutVelocityInternalCents7d: number
  vendorPayoutVelocityInternalCents30d: number
  pendingPayablePressureCents: number
  insights: BlitzpayApInsight[]
}

function mapPayableRow(r: Record<string, unknown>): VendorPayableListRow {
  return {
    id: String(r.id),
    vendorKind: String(r.vendor_kind) as VendorPayableVendorKind,
    counterpartyLabel: String(r.counterparty_label ?? ""),
    orgVendorId: r.org_vendor_id ? String(r.org_vendor_id) : null,
    amountCents: Math.max(0, Math.round(Number(r.amount_cents))),
    currency: String(r.currency ?? "usd"),
    dueDate: String(r.due_date ?? "").slice(0, 10),
    scheduledPayoutDate: r.scheduled_payout_date ? String(r.scheduled_payout_date).slice(0, 10) : null,
    paidAt: r.paid_at ? String(r.paid_at) : null,
    status: String(r.status ?? "draft"),
    approvalNotes: r.approval_notes ? String(r.approval_notes) : null,
    approvedByUserId: r.approved_by_user_id ? String(r.approved_by_user_id) : null,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    requestedByUserId: r.requested_by_user_id ? String(r.requested_by_user_id) : null,
    workOrderId: r.work_order_id ? String(r.work_order_id) : null,
    orgInvoiceId: r.org_invoice_id ? String(r.org_invoice_id) : null,
    orgPurchaseOrderId: r.org_purchase_order_id ? String(r.org_purchase_order_id) : null,
    reimbursementFlag: Boolean(r.reimbursement_flag),
    materialCostFlag: Boolean(r.material_cost_flag),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  }
}

export async function fetchOrgVendorPayablesForDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VendorPayableListRow[]> {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_vendor_payables")
    .select(
      [
        "id",
        "vendor_kind",
        "counterparty_label",
        "org_vendor_id",
        "amount_cents",
        "currency",
        "due_date",
        "scheduled_payout_date",
        "paid_at",
        "status",
        "approval_notes",
        "approved_by_user_id",
        "approved_at",
        "requested_by_user_id",
        "work_order_id",
        "org_invoice_id",
        "org_purchase_order_id",
        "reimbursement_flag",
        "material_cost_flag",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true })
    .limit(PAYABLE_PAGE)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapPayableRow(row as Record<string, unknown>))
}

export function buildVendorExposure(rows: VendorPayableListRow[], todayYmd: string): VendorExposureRow[] {
  const todayMs = Date.parse(`${todayYmd}T00:00:00.000Z`)
  const byKey = new Map<
    string,
    { label: string; openCents: number; overdueOpenCents: number; openCount: number }
  >()
  for (const r of rows) {
    if (!isOpenVendorPayableStatus(r.status)) continue
    const key = r.orgVendorId ?? `label:${r.counterpartyLabel.trim().toLowerCase()}`
    const dueMs = Date.parse(`${r.dueDate}T00:00:00.000Z`)
    const cur = byKey.get(key) ?? { label: r.counterpartyLabel, openCents: 0, overdueOpenCents: 0, openCount: 0 }
    cur.openCents += r.amountCents
    cur.openCount += 1
    if (Number.isFinite(dueMs) && dueMs < todayMs) cur.overdueOpenCents += r.amountCents
    byKey.set(key, cur)
  }
  return [...byKey.entries()]
    .map(([counterpartyKey, v]) => ({
      counterpartyKey,
      label: v.label,
      openCents: v.openCents,
      overdueOpenCents: v.overdueOpenCents,
      openCount: v.openCount,
    }))
    .sort((a, b) => b.openCents - a.openCents)
}

export async function fetchBlitzpayApDashboard(
  admin: SupabaseClient,
  organizationId: string,
  options?: { achPendingCount?: number },
): Promise<BlitzpayApDashboardPayload> {
  assertUuid(organizationId, "organizationId")
  const todayYmd = utcTodayYmd()
  const payables = await fetchOrgVendorPayablesForDashboard(admin, organizationId)
  const bucketRows = payables.map((p) => ({
    amount_cents: p.amountCents,
    due_date: p.dueDate,
    status: p.status,
    reimbursement_flag: p.reimbursementFlag,
    material_cost_flag: p.materialCostFlag,
    work_order_id: p.workOrderId,
  }))
  const buckets = aggregateApObligationBuckets(bucketRows, todayYmd)
  const vendorExposure = buildVendorExposure(payables, todayYmd)

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()
  let vendorPayoutVelocityInternalCents7d = 0
  let vendorPayoutVelocityInternalCents30d = 0
  {
    const { data, error } = await admin
      .from("blitzpay_vendor_payouts")
      .select("amount_cents, recorded_at")
      .eq("organization_id", organizationId)
      .gte("recorded_at", since30d)
    if (!error && data) {
      vendorPayoutVelocityInternalCents7d = vendorPayoutVelocityPaidCents(
        data as Array<{ amount_cents: number; recorded_at: string }>,
        since7d,
      )
      vendorPayoutVelocityInternalCents30d = vendorPayoutVelocityPaidCents(
        data as Array<{ amount_cents: number; recorded_at: string }>,
        since30d,
      )
    }
  }

  const treasury = await fetchBlitzpayTreasuryDashboard(admin, organizationId, {
    achPendingCount: options?.achPendingCount,
  })
  const apProjectedOutgoingCents7d = projectedOutgoingCashCents({
    apOpenDueWithin7DaysCents: buckets.dueWithin7DaysOpenCents,
    stripeEstimateUpcomingTransferCents: treasury.estimateUpcomingTransferCents,
  })

  const pendingPayablePressureCents = buckets.outstandingOpenCents

  const overdueLabels = vendorExposure.filter((v) => v.overdueOpenCents > 0).map((v) => v.label)
  const insights = buildBlitzpayApInsights({
    buckets,
    operatingBalanceCents: treasury.operatingBalanceCents,
    reserveTargetCents: treasury.reserveTargetCents,
    stripeEstimateUpcomingTransferCents: treasury.estimateUpcomingTransferCents,
    overdueVendorLabels: overdueLabels.slice(0, 8),
  })

  return {
    todayYmd,
    payables,
    buckets,
    vendorExposure,
    treasury,
    apProjectedOutgoingCents7d,
    vendorPayoutVelocityInternalCents7d,
    vendorPayoutVelocityInternalCents30d,
    pendingPayablePressureCents,
    insights,
  }
}

export type CreateVendorPayableInput = {
  vendorKind: VendorPayableVendorKind
  counterpartyLabel: string
  orgVendorId?: string | null
  amountCents: number
  dueDate: string
  workOrderId?: string | null
  orgInvoiceId?: string | null
  orgPurchaseOrderId?: string | null
  reimbursementFlag?: boolean
  materialCostFlag?: boolean
  requestedByUserId: string | null
}

export async function insertBlitzpayVendorPayable(
  admin: SupabaseClient,
  organizationId: string,
  input: CreateVendorPayableInput,
): Promise<{ id: string }> {
  assertUuid(organizationId, "organizationId")
  if (input.workOrderId) {
    assertUuid(input.workOrderId, "workOrderId")
    const { data: wo, error: wErr } = await admin
      .from("work_orders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.workOrderId)
      .maybeSingle()
    if (wErr) throw new Error(wErr.message)
    if (!wo) throw new Error("Work order not found for this organization.")
  }
  const due = String(input.dueDate).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("dueDate must be YYYY-MM-DD")
  const { data, error } = await admin
    .from("blitzpay_vendor_payables")
    .insert({
      organization_id: organizationId,
      vendor_kind: input.vendorKind,
      counterparty_label: input.counterpartyLabel.trim(),
      org_vendor_id: input.orgVendorId ?? null,
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      due_date: due,
      status: "draft",
      reimbursement_flag: Boolean(input.reimbursementFlag),
      material_cost_flag: Boolean(input.materialCostFlag),
      work_order_id: input.workOrderId ?? null,
      org_invoice_id: input.orgInvoiceId ?? null,
      org_purchase_order_id: input.orgPurchaseOrderId ?? null,
      requested_by_user_id: input.requestedByUserId,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: String((data as { id: string }).id) }
}

export type PatchVendorPayableInput = {
  status?: string
  scheduledPayoutDate?: string | null
  approvalNotes?: string | null
  /** When transitioning to approved, stamps approver. */
  actingUserId?: string | null
}

export async function patchBlitzpayVendorPayable(
  admin: SupabaseClient,
  organizationId: string,
  payableId: string,
  input: PatchVendorPayableInput,
): Promise<void> {
  assertUuid(organizationId, "organizationId")
  assertUuid(payableId, "payableId")

  const { data: cur, error: cErr } = await admin
    .from("blitzpay_vendor_payables")
    .select("id, status, amount_cents, currency")
    .eq("organization_id", organizationId)
    .eq("id", payableId)
    .maybeSingle()
  if (cErr) throw new Error(cErr.message)
  if (!cur) throw new Error("Payable not found")

  const prevStatus = String((cur as { status: string }).status)
  const nextStatus = input.status != null ? String(input.status) : prevStatus
  if (input.status != null) {
    assertValidVendorPayableTransition(prevStatus, nextStatus)
  }

  const patch: Record<string, unknown> = {}
  if (input.status != null) patch.status = nextStatus
  if (input.scheduledPayoutDate !== undefined) {
    const s = input.scheduledPayoutDate
    patch.scheduled_payout_date = s == null || s === "" ? null : String(s).trim().slice(0, 10)
  }
  if (input.approvalNotes !== undefined) patch.approval_notes = input.approvalNotes

  if (nextStatus === "approved" && prevStatus !== "approved") {
    patch.approved_by_user_id = input.actingUserId ?? null
    patch.approved_at = new Date().toISOString()
  }
  if (nextStatus === "paid") {
    patch.paid_at = new Date().toISOString()
  }
  if (nextStatus !== "paid" && prevStatus === "paid") {
    patch.paid_at = null
  }

  const { error: uErr } = await admin.from("blitzpay_vendor_payables").update(patch).eq("id", payableId)
  if (uErr) throw new Error(uErr.message)

  if (nextStatus === "paid" && prevStatus !== "paid") {
    const row = cur as { amount_cents: number; currency?: string }
    const { error: insErr } = await admin.from("blitzpay_vendor_payouts").insert({
      organization_id: organizationId,
      vendor_payable_id: payableId,
      amount_cents: Math.max(0, Math.round(Number(row.amount_cents))),
      currency: String(row.currency ?? "usd").toLowerCase(),
      settlement_channel: "internal_record",
    })
    if (insErr) throw new Error(insErr.message)
  }
}

/** Work-order BlitzPay summary slice (aggregates safe for field technicians). */
export type WorkOrderVendorPayablesFieldSlice = {
  openObligationCents: number
  openCount: number
  overdueCount: number
  hasReimbursementOpen: boolean
  hasMaterialOpen: boolean
}

export type WorkOrderVendorPayablesStaffRow = {
  id: string
  vendorKind: VendorPayableVendorKind
  counterpartyLabel: string
  amountCents: number
  dueDate: string
  status: string
  scheduledPayoutDate: string | null
  reimbursementFlag: boolean
  materialCostFlag: boolean
}

export async function fetchWorkOrderVendorPayablesSlice(
  admin: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  options: { staffDetail: boolean },
): Promise<{ field: WorkOrderVendorPayablesFieldSlice; staff: WorkOrderVendorPayablesStaffRow[] | null }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(workOrderId, "workOrderId")
  const { data, error } = await admin
    .from("blitzpay_vendor_payables")
    .select(
      [
        "id",
        "vendor_kind",
        "counterparty_label",
        "amount_cents",
        "due_date",
        "scheduled_payout_date",
        "status",
        "reimbursement_flag",
        "material_cost_flag",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .order("due_date", { ascending: true })
    .limit(80)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const todayYmd = utcTodayYmd()
  const todayMs = Date.parse(`${todayYmd}T00:00:00.000Z`)

  let openObligationCents = 0
  let openCount = 0
  let overdueCount = 0
  let hasReimbursementOpen = false
  let hasMaterialOpen = false

  const staff: WorkOrderVendorPayablesStaffRow[] = []

  for (const r of rows) {
    const st = String(r.status ?? "")
    const cents = Math.max(0, Math.round(Number(r.amount_cents)))
    const due = String(r.due_date ?? "").slice(0, 10)
    const open = isOpenVendorPayableStatus(st)
    if (open) {
      openObligationCents += cents
      openCount += 1
      const dueMs = Date.parse(`${due}T00:00:00.000Z`)
      if (Number.isFinite(dueMs) && dueMs < todayMs) overdueCount += 1
      if (Boolean(r.reimbursement_flag)) hasReimbursementOpen = true
      if (Boolean(r.material_cost_flag)) hasMaterialOpen = true
    }
    if (options.staffDetail) {
      staff.push({
        id: String(r.id),
        vendorKind: String(r.vendor_kind) as VendorPayableVendorKind,
        counterpartyLabel: String(r.counterparty_label ?? ""),
        amountCents: cents,
        dueDate: due,
        status: st,
        scheduledPayoutDate: r.scheduled_payout_date ? String(r.scheduled_payout_date).slice(0, 10) : null,
        reimbursementFlag: Boolean(r.reimbursement_flag),
        materialCostFlag: Boolean(r.material_cost_flag),
      })
    }
  }

  return {
    field: {
      openObligationCents,
      openCount,
      overdueCount,
      hasReimbursementOpen,
      hasMaterialOpen,
    },
    staff: options.staffDetail ? staff : null,
  }
}

export async function fetchApReportingExtras(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  apOpenOutstandingCents: number
  apDue7OpenCents: number
  apDue30OpenCents: number
  apDue60OpenCents: number
  apVendorInternalVelocity7dCents: number
  apProjectedOutgoingCents7d: number
}> {
  assertUuid(organizationId, "organizationId")
  const todayYmd = utcTodayYmd()
  const rows = await fetchOrgVendorPayablesForDashboard(admin, organizationId)
  const buckets = aggregateApObligationBuckets(
    rows.map((p) => ({
      amount_cents: p.amountCents,
      due_date: p.dueDate,
      status: p.status,
      reimbursement_flag: p.reimbursementFlag,
      material_cost_flag: p.materialCostFlag,
      work_order_id: p.workOrderId,
    })),
    todayYmd,
  )
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString()
  let apVendorInternalVelocity7dCents = 0
  {
    const { data, error } = await admin
      .from("blitzpay_vendor_payouts")
      .select("amount_cents, recorded_at")
      .eq("organization_id", organizationId)
      .gte("recorded_at", since7d)
    if (!error && data) {
      apVendorInternalVelocity7dCents = vendorPayoutVelocityPaidCents(
        data as Array<{ amount_cents: number; recorded_at: string }>,
        since7d,
      )
    }
  }
  let stripeEstimate = 0
  try {
    const tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
    stripeEstimate = tm.estimateUpcomingTransferCents
  } catch {
    stripeEstimate = 0
  }
  const apProjectedOutgoingCents7d = projectedOutgoingCashCents({
    apOpenDueWithin7DaysCents: buckets.dueWithin7DaysOpenCents,
    stripeEstimateUpcomingTransferCents: stripeEstimate,
  })
  return {
    apOpenOutstandingCents: buckets.outstandingOpenCents,
    apDue7OpenCents: buckets.dueWithin7DaysOpenCents,
    apDue30OpenCents: buckets.dueWithin30DaysOpenCents,
    apDue60OpenCents: buckets.dueWithin60DaysOpenCents,
    apVendorInternalVelocity7dCents,
    apProjectedOutgoingCents7d,
  }
}
