import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS,
  BLITZPAY_AP_BILL_LIST_CAP,
  BLITZPAY_AP_RUN_LIST_CAP,
  BLITZPAY_AP_VENDOR_LIST_CAP,
  assertPurchaseOrderOrgMatch,
  buildBillAccrualJournalLines,
  computeApCashOptimizationScore0to100,
  computeAverageVendorPaymentDaysFromCompletedAllocations,
  computePayableAgingHealthScore0to100,
  computeTreasuryCoverageForPayablesBps,
  computeVendorConcentrationRisk0to100,
  deriveApprovalRequired,
  assertAllocationIntegrity,
} from "@/lib/blitzpay/blitzpay-ap-automation"
import { bucketVendorBillAging } from "@/lib/blitzpay/blitzpay-vendor-aging"
import {
  BLITZPAY_VENDOR_COA_EXTENSION,
  hashAccountingSourceReference,
  normalBalanceForAccountType,
} from "@/lib/blitzpay/blitzpay-general-ledger"
import {
  createJournalBatch,
  createJournalEntryWithLines,
  ensureBlitzpayDefaultChartOfAccounts,
  postJournalEntry,
} from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"

const OPEN_AP_STATUSES = ["pending_approval", "approved", "scheduled", "partially_paid", "disputed"] as const

export type BlitzpayApReportingFields = {
  accountsPayableOutstandingCents: number
  approvedBillsAwaitingPaymentCents: number
  overdueVendorBillsCents: number
  averageVendorPaymentDays: number | null
  vendorConcentrationRisk: number
  treasuryCoverageForPayables: number
  payableAgingHealthScore: number
}

export async function ensureBlitzpayDefaultVendorAccounts(admin: SupabaseClient, organizationId: string): Promise<{ created: number }> {
  await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  let created = 0
  for (const row of BLITZPAY_VENDOR_COA_EXTENSION) {
    const normal = normalBalanceForAccountType(row.type)
    const { data: existing } = await admin
      .from("blitzpay_chart_of_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("account_code", row.code)
      .maybeSingle()
    if (existing) continue
    const { error } = await admin.from("blitzpay_chart_of_accounts").insert({
      organization_id: organizationId,
      account_code: row.code,
      account_name: row.name,
      account_type: row.type,
      parent_account_id: null,
      is_system_account: true,
      is_active: true,
      normal_balance: normal,
      reporting_category: "system_seed_phase_3b",
      currency: "usd",
      metadata: { seed: "blitzpay_phase_3b_vendor" },
    })
    if (error) throw new Error(error.message)
    created += 1
  }
  return { created }
}

async function coaIdByCode(admin: SupabaseClient, organizationId: string, code: string): Promise<string | null> {
  const { data } = await admin
    .from("blitzpay_chart_of_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("account_code", code)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function insertApAuditEvent(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    action: string
    vendorBillId?: string | null
    paymentRunId?: string | null
    actorUserId?: string | null
    details?: Record<string, unknown>
  },
) {
  assertUuid(organizationId, "organizationId")
  const { error } = await admin.from("blitzpay_ap_audit_events").insert({
    organization_id: organizationId,
    action: input.action,
    vendor_bill_id: input.vendorBillId ?? null,
    payment_run_id: input.paymentRunId ?? null,
    actor_user_id: input.actorUserId ?? null,
    details: input.details ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function listBlitzpayVendors(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_vendors")
    .select(
      "id, vendor_name, vendor_code, vendor_status, vendor_type, payment_terms_days, preferred_payment_method, default_expense_account_id, default_ap_account_id, created_at",
    )
    .eq("organization_id", organizationId)
    .order("vendor_name", { ascending: true })
    .limit(BLITZPAY_AP_VENDOR_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createBlitzpayVendor(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    vendorName: string
    vendorCode?: string | null
    vendorType?: string
    vendorStatus?: string
    paymentTermsDays?: number
    preferredPaymentMethod?: string
    defaultExpenseAccountId?: string | null
    defaultApAccountId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultVendorAccounts(admin, organizationId)
  const apDefault = input.defaultApAccountId ?? (await coaIdByCode(admin, organizationId, "2000"))
  const row = {
    organization_id: organizationId,
    vendor_name: String(input.vendorName || "").trim() || "Vendor",
    vendor_code: input.vendorCode?.trim() || null,
    vendor_type: input.vendorType ?? "supplier",
    vendor_status: input.vendorStatus ?? "active",
    payment_terms_days: Math.min(3650, Math.max(0, Math.round(Number(input.paymentTermsDays ?? 30)))),
    preferred_payment_method: input.preferredPaymentMethod ?? "ach",
    default_expense_account_id: input.defaultExpenseAccountId ?? null,
    default_ap_account_id: apDefault,
    metadata: {},
  }
  const { data, error } = await admin.from("blitzpay_vendors").insert(row).select("id").single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function listVendorBills(admin: SupabaseClient, organizationId: string, status?: string) {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_vendor_bills")
    .select(
      "id, vendor_id, bill_number, bill_status, bill_date, due_date, total_cents, remaining_balance_cents, approval_required, approved_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true })
    .limit(BLITZPAY_AP_BILL_LIST_CAP)
  if (status) q = q.eq("bill_status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const bills = (data ?? []) as Array<Record<string, unknown> & { vendor_id: string }>
  if (!bills.length) return bills
  const vids = [...new Set(bills.map((b) => b.vendor_id))].slice(0, BLITZPAY_AP_VENDOR_LIST_CAP)
  const { data: vendors } = await admin.from("blitzpay_vendors").select("id, vendor_name").in("id", vids)
  const nameById = new Map((vendors ?? []).map((v) => [(v as { id: string }).id, (v as { vendor_name: string }).vendor_name]))
  return bills.map((b) => ({ ...b, vendor_name: nameById.get(b.vendor_id) ?? null }))
}

export async function createVendorBillWithLines(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    vendorId: string
    billNumber: string
    billDate: string
    dueDate: string
    taxCents: number
    memo?: string | null
    sourceType?: string
    linkedPurchaseOrderId?: string | null
    linkedWorkOrderId?: string | null
    linkedInvoiceId?: string | null
    externalReference?: string | null
    lines: Array<{
      expenseAccountId: string
      lineTotalCents: number
      description?: string | null
      linkedEquipmentId?: string | null
      linkedWorkOrderId?: string | null
      linkedInventoryItemId?: string | null
    }>
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.vendorId, "vendorId")
  await ensureBlitzpayDefaultVendorAccounts(admin, organizationId)

  if (input.linkedPurchaseOrderId) {
    assertUuid(input.linkedPurchaseOrderId, "linkedPurchaseOrderId")
    const { data: po } = await admin
      .from("org_purchase_orders")
      .select("organization_id")
      .eq("id", input.linkedPurchaseOrderId)
      .maybeSingle()
    const g = assertPurchaseOrderOrgMatch(po as { organization_id: string } | null, organizationId)
    if (!g.ok) throw new Error(g.reason)
  }

  const subtotal = input.lines.reduce((s, ln) => s + Math.max(0, Math.round(ln.lineTotalCents)), 0)
  const tax = Math.max(0, Math.round(input.taxCents))
  if (subtotal <= 0 && tax <= 0) throw new Error("bill_amount_required")
  const total = subtotal + tax
  const approvalRequired = deriveApprovalRequired(total, BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS)
  const billStatus = approvalRequired ? "pending_approval" : "draft"

  const meta: Record<string, unknown> = {}
  if (input.externalReference?.trim()) {
    meta.external_reference_hash = hashAccountingSourceReference(input.externalReference.trim())
  }

  const { data: bill, error: bErr } = await admin
    .from("blitzpay_vendor_bills")
    .insert({
      organization_id: organizationId,
      vendor_id: input.vendorId,
      bill_number: String(input.billNumber || "").trim() || `BILL-${Date.now()}`,
      bill_status: billStatus,
      bill_date: input.billDate.slice(0, 10),
      due_date: input.dueDate.slice(0, 10),
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      remaining_balance_cents: total,
      source_type: input.sourceType ?? "manual",
      external_reference_hash: (meta.external_reference_hash as string | undefined) ?? null,
      approval_required: approvalRequired,
      memo: input.memo ?? null,
      linked_purchase_order_id: input.linkedPurchaseOrderId ?? null,
      linked_work_order_id: input.linkedWorkOrderId ?? null,
      linked_invoice_id: input.linkedInvoiceId ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (bErr || !bill) throw new Error(bErr?.message ?? "bill_insert_failed")
  const billId = (bill as { id: string }).id

  const lineRows = input.lines.map((ln) => ({
    organization_id: organizationId,
    vendor_bill_id: billId,
    expense_account_id: ln.expenseAccountId,
    description: ln.description ?? null,
    quantity: 1,
    unit_cost_cents: Math.max(0, Math.round(ln.lineTotalCents)),
    line_total_cents: Math.max(0, Math.round(ln.lineTotalCents)),
    linked_equipment_id: ln.linkedEquipmentId ?? null,
    linked_work_order_id: ln.linkedWorkOrderId ?? null,
    linked_inventory_item_id: ln.linkedInventoryItemId ?? null,
    metadata: {},
  }))
  if (lineRows.length) {
    const { error: lErr } = await admin.from("blitzpay_vendor_bill_lines").insert(lineRows)
    if (lErr) throw new Error(lErr.message)
  }

  if (approvalRequired) {
    const { error: aErr } = await admin.from("blitzpay_ap_approval_flows").insert({
      organization_id: organizationId,
      vendor_bill_id: billId,
      approval_status: "pending",
      current_stage: 0,
      max_stage: 1,
      metadata: {},
    })
    if (aErr) throw new Error(aErr.message)
  }

  await insertApAuditEvent(admin, organizationId, {
    action: "vendor_bill_created",
    vendorBillId: billId,
    actorUserId: input.actorUserId ?? null,
    details: { bill_status: billStatus, total_cents: total },
  })
  return { id: billId, billStatus }
}

export async function approveVendorBill(
  admin: SupabaseClient,
  organizationId: string,
  billId: string,
  actorUserId: string,
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(billId, "billId")
  assertUuid(actorUserId, "actorUserId")
  await ensureBlitzpayDefaultVendorAccounts(admin, organizationId)

  const { data: bill, error: b0 } = await admin
    .from("blitzpay_vendor_bills")
    .select("id, vendor_id, bill_status, approval_required, total_cents, tax_cents, subtotal_cents, metadata")
    .eq("organization_id", organizationId)
    .eq("id", billId)
    .single()
  if (b0 || !bill) throw new Error("bill_not_found")

  const b = bill as {
    id: string
    vendor_id: string
    bill_status: string
    approval_required: boolean
    total_cents: number
    tax_cents: number
    subtotal_cents: number
    metadata: Record<string, unknown> | null
  }
  if (b.approval_required && b.bill_status !== "pending_approval") throw new Error("bill_not_pending_approval")
  if (!b.approval_required && b.bill_status !== "draft" && b.bill_status !== "pending_approval") {
    throw new Error("bill_not_approvable")
  }

  const { data: vendor } = await admin
    .from("blitzpay_vendors")
    .select("default_ap_account_id, default_expense_account_id")
    .eq("id", b.vendor_id)
    .eq("organization_id", organizationId)
    .maybeSingle()
  const v = vendor as { default_ap_account_id: string | null; default_expense_account_id: string | null } | null

  const prevMeta = (b.metadata ?? {}) as Record<string, unknown>
  const accrualPosted = Boolean(prevMeta.accrual_posted)
  if (!accrualPosted) {
    const { data: lines } = await admin
      .from("blitzpay_vendor_bill_lines")
      .select("expense_account_id, line_total_cents, description")
      .eq("vendor_bill_id", billId)
      .eq("organization_id", organizationId)
      .limit(80)
    const expenseLines = (lines ?? []).map((r) => ({
      expenseAccountId: (r as { expense_account_id: string }).expense_account_id,
      amountCents: Math.round(Number((r as { line_total_cents: number }).line_total_cents)),
      description: (r as { description: string | null }).description,
    }))
    const tax = Math.max(0, Math.round(b.tax_cents))
    if (!expenseLines.length && tax <= 0) throw new Error("bill_lines_required")
    const fallbackExpense =
      (await coaIdByCode(admin, organizationId, "5500")) ??
      v?.default_expense_account_id ??
      expenseLines[0]?.expenseAccountId
    if (tax > 0) {
      const primary = expenseLines[0]?.expenseAccountId ?? fallbackExpense
      if (!primary) throw new Error("expense_account_missing_for_tax")
      expenseLines.push({
        expenseAccountId: v?.default_expense_account_id ?? primary,
        amountCents: tax,
        description: "Purchase tax / use tax (vendor bill)",
      })
    }
    const apAccountId = v?.default_ap_account_id ?? (await coaIdByCode(admin, organizationId, "2000"))
    if (!apAccountId) throw new Error("ap_account_missing")
    const jl = buildBillAccrualJournalLines({
      lineExpenses: expenseLines,
      accountsPayableAccountId: apAccountId,
      apCreditDescription: `AP accrual bill ${billId.slice(0, 8)}`,
    })
    const batchRef = `ap:accrual:${billId}:${randomUUID()}`
    const { id: batchId } = await createJournalBatch(admin, organizationId, {
      batchReference: batchRef,
      batchType: "ap",
      sourceType: "vendor_bill",
      sourceId: billId,
    })
    const { id: entryId } = await createJournalEntryWithLines(admin, organizationId, {
      batchId,
      entryReference: `${batchRef}:entry`,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: "Vendor bill accrual",
      sourceType: "vendor_bill",
      sourceId: billId,
      lines: jl.map((ln) => ({
        ...ln,
        metadata: { ...(ln.metadata ?? {}), vendor_bill_id: billId, blitzpay_vendor_id: b.vendor_id },
      })),
    })
    await postJournalEntry(admin, organizationId, entryId)
    await admin
      .from("blitzpay_vendor_bills")
      .update({
        metadata: {
          ...prevMeta,
          accrual_posted: true,
          accrual_entry_id: entryId,
          accrual_batch_id: batchId,
        },
        approved_at: new Date().toISOString(),
        approved_by: actorUserId,
        bill_status: "approved",
      })
      .eq("id", billId)
      .eq("organization_id", organizationId)
  } else {
    await admin
      .from("blitzpay_vendor_bills")
      .update({
        approved_at: new Date().toISOString(),
        approved_by: actorUserId,
        bill_status: "approved",
      })
      .eq("id", billId)
      .eq("organization_id", organizationId)
  }

  const { data: flow } = await admin
    .from("blitzpay_ap_approval_flows")
    .select("id")
    .eq("vendor_bill_id", billId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (flow) {
    await admin
      .from("blitzpay_ap_approval_flows")
      .update({
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        assigned_approver: actorUserId,
      })
      .eq("id", (flow as { id: string }).id)
  }

  await insertApAuditEvent(admin, organizationId, {
    action: "vendor_bill_approved",
    vendorBillId: billId,
    actorUserId,
    details: {},
  })
}

export async function rejectVendorBill(
  admin: SupabaseClient,
  organizationId: string,
  billId: string,
  actorUserId: string,
  reason: string,
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(billId, "billId")
  const { data: bill } = await admin
    .from("blitzpay_vendor_bills")
    .select("bill_status")
    .eq("id", billId)
    .eq("organization_id", organizationId)
    .single()
  if (!bill || (bill as { bill_status: string }).bill_status !== "pending_approval") {
    throw new Error("bill_not_pending_approval")
  }
  await admin
    .from("blitzpay_vendor_bills")
    .update({ bill_status: "draft" })
    .eq("id", billId)
    .eq("organization_id", organizationId)
  await admin
    .from("blitzpay_ap_approval_flows")
    .update({
      approval_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: String(reason || "").slice(0, 2000),
    })
    .eq("vendor_bill_id", billId)
    .eq("organization_id", organizationId)
  await insertApAuditEvent(admin, organizationId, {
    action: "vendor_bill_rejected",
    vendorBillId: billId,
    actorUserId,
    details: { reason: String(reason || "").slice(0, 500) },
  })
}

export async function scheduleVendorBill(
  admin: SupabaseClient,
  organizationId: string,
  billId: string,
  actorUserId: string,
  options?: { scheduledForIso?: string | null },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(billId, "billId")
  const { data: bill } = await admin
    .from("blitzpay_vendor_bills")
    .select("id, remaining_balance_cents, bill_status, due_date")
    .eq("id", billId)
    .eq("organization_id", organizationId)
    .single()
  if (!bill) throw new Error("bill_not_found")
  const row = bill as { remaining_balance_cents: number; bill_status: string; due_date: string }
  if (row.bill_status !== "approved") throw new Error("bill_not_approved")
  const beforeRem = Math.round(row.remaining_balance_cents)
  const allocAmt = beforeRem
  const integ = assertAllocationIntegrity(allocAmt, beforeRem)
  if (!integ.ok) throw new Error(integ.reason)
  const remainingAfter = Math.max(0, beforeRem - allocAmt)

  const runRef = `aprun:${randomUUID()}`
  const scheduledFor = options?.scheduledForIso?.trim()
    ? new Date(options.scheduledForIso).toISOString()
    : new Date(Date.now() + 86400000).toISOString()

  const { data: run, error: rErr } = await admin
    .from("blitzpay_ap_payment_runs")
    .insert({
      organization_id: organizationId,
      run_reference: runRef,
      run_status: "scheduled",
      scheduled_for: scheduledFor,
      total_bills: 1,
      total_amount_cents: allocAmt,
      treasury_health_status: "watch",
      created_by: actorUserId,
      metadata: { orchestration_only: true },
    })
    .select("id")
    .single()
  if (rErr || !run) throw new Error(rErr?.message ?? "run_insert_failed")
  const runId = (run as { id: string }).id

  const { error: aErr } = await admin.from("blitzpay_ap_payment_allocations").insert({
    organization_id: organizationId,
    payment_run_id: runId,
    vendor_bill_id: billId,
    allocation_status: "scheduled",
    allocated_amount_cents: allocAmt,
    remaining_bill_balance_cents: remainingAfter,
    provider: "external",
    metadata: { bill_due_date: row.due_date.slice(0, 10), orchestration_only: true },
  })
  if (aErr) throw new Error(aErr.message)

  const nextStatus = remainingAfter === 0 ? "scheduled" : "partially_paid"
  await admin
    .from("blitzpay_vendor_bills")
    .update({ bill_status: nextStatus, remaining_balance_cents: remainingAfter })
    .eq("id", billId)
    .eq("organization_id", organizationId)

  await insertApAuditEvent(admin, organizationId, {
    action: "vendor_bill_scheduled",
    vendorBillId: billId,
    paymentRunId: runId,
    actorUserId,
    details: { allocated_amount_cents: allocAmt, orchestration_only: true },
  })
}

export async function listApPaymentRuns(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_ap_payment_runs")
    .select("id, run_reference, run_status, scheduled_for, total_bills, total_amount_cents, treasury_health_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_AP_RUN_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createApPaymentRunDraft(admin: SupabaseClient, organizationId: string, actorUserId: string) {
  assertUuid(organizationId, "organizationId")
  const runRef = `aprun:draft:${randomUUID()}`
  const { data, error } = await admin
    .from("blitzpay_ap_payment_runs")
    .insert({
      organization_id: organizationId,
      run_reference: runRef,
      run_status: "draft",
      total_bills: 0,
      total_amount_cents: 0,
      created_by: actorUserId,
      metadata: { orchestration_only: true },
    })
    .select("id, run_reference")
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; run_reference: string }
}

export async function fetchVendorAgingSummary(admin: SupabaseClient, organizationId: string, asOfYmd: string) {
  assertUuid(organizationId, "organizationId")
  const day = asOfYmd.slice(0, 10)
  const { data: bills } = await admin
    .from("blitzpay_vendor_bills")
    .select("vendor_id, remaining_balance_cents, due_date, bill_status")
    .eq("organization_id", organizationId)
    .in("bill_status", [...OPEN_AP_STATUSES])
    .gt("remaining_balance_cents", 0)
    .limit(BLITZPAY_AP_BILL_LIST_CAP)
    if (!bills?.length) return { asOfDate: day, vendors: [] as Array<{ vendorId: string; buckets: ReturnType<typeof bucketVendorBillAging> }> }

  const byVendor = new Map<string, Array<{ remaining_balance_cents: number; due_date: string }>>()
  for (const r of bills as Array<{ vendor_id: string; remaining_balance_cents: number; due_date: string }>) {
    const arr = byVendor.get(r.vendor_id) ?? []
    arr.push({ remaining_balance_cents: r.remaining_balance_cents, due_date: r.due_date })
    byVendor.set(r.vendor_id, arr)
  }
  const vendorIds = [...byVendor.keys()].sort((a, b) => a.localeCompare(b)).slice(0, BLITZPAY_AP_VENDOR_LIST_CAP)
  const out: Array<{ vendorId: string; buckets: ReturnType<typeof bucketVendorBillAging> }> = []
  for (const vid of vendorIds) {
    const rows = byVendor.get(vid) ?? []
    out.push({ vendorId: vid, buckets: bucketVendorBillAging(rows, day) })
  }
  const { data: vrows } =
    vendorIds.length ?
      await admin
        .from("blitzpay_vendors")
        .select("id, vendor_name")
        .eq("organization_id", organizationId)
        .in("id", vendorIds)
    : { data: [] as { id: string; vendor_name: string }[] }
  const nameById = new Map((vrows ?? []).map((v) => [(v as { id: string }).id, (v as { vendor_name: string }).vendor_name]))
  return {
    asOfDate: day,
    vendors: out.map((o) => ({ ...o, vendor_name: nameById.get(o.vendorId) ?? null })),
  }
}

export async function fetchApHealthDashboard(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultVendorAccounts(admin, organizationId)
  const today = new Date().toISOString().slice(0, 10)
  const snap = await fetchApReportingSnapshotFields(admin, organizationId)
  let operating = 0
  try {
    const tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
    operating = tm.operatingBalanceCents
  } catch {
    operating = 0
  }
  const coverageBps = computeTreasuryCoverageForPayablesBps(operating, snap.approvedBillsAwaitingPaymentCents)
  const { data: bills } = await admin
    .from("blitzpay_vendor_bills")
    .select("id, vendor_id, bill_status, due_date, remaining_balance_cents, total_cents, approved_at")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true })
    .limit(BLITZPAY_AP_BILL_LIST_CAP)
  const rows = (bills ?? []) as Array<{
    id: string
    vendor_id: string
    bill_status: string
    due_date: string
    remaining_balance_cents: number
    total_cents: number
  }>
  const upcoming = rows
    .filter((r) => r.remaining_balance_cents > 0 && ["approved", "scheduled", "partially_paid"].includes(r.bill_status))
    .slice(0, 12)
  const queue = rows.filter((r) => r.bill_status === "pending_approval").slice(0, 12)
  const vendorTotals = new Map<string, number>()
  for (const r of rows) {
    if (r.remaining_balance_cents <= 0) continue
    vendorTotals.set(r.vendor_id, (vendorTotals.get(r.vendor_id) ?? 0) + r.remaining_balance_cents)
  }
  const concentration = computeVendorConcentrationRisk0to100([...vendorTotals.values()])
  const overdue = snap.overdueVendorBillsCents
  const totalOpen = snap.accountsPayableOutstandingCents
  const agingScore = computePayableAgingHealthScore0to100({
    overdueCents: overdue,
    totalOpenCents: totalOpen,
    treasuryCoverageBps: coverageBps,
  })
  const due7 = rows
    .filter((r) => {
      if (r.remaining_balance_cents <= 0) return false
      const d = new Date(`${r.due_date.slice(0, 10)}T12:00:00.000Z`).getTime()
      const t = new Date(`${today}T12:00:00.000Z`).getTime()
      const diff = (d - t) / 86400000
      return diff >= 0 && diff <= 7
    })
    .reduce((s, r) => s + r.remaining_balance_cents, 0)
  const optScore = computeApCashOptimizationScore0to100({
    treasuryCoverageBps: coverageBps,
    due7dCents: due7,
    operatingCashCents: operating,
  })

  const { data: runs } = await admin
    .from("blitzpay_ap_payment_runs")
    .select("id, run_reference, run_status, total_amount_cents, scheduled_for")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(8)

  const vendorIdsForLabels = [...new Set([...upcoming.map((r) => r.vendor_id), ...queue.map((r) => r.vendor_id)])]
  let vendorNameById = new Map<string, string>()
  if (vendorIdsForLabels.length) {
    const { data: vrows } = await admin
      .from("blitzpay_vendors")
      .select("id, vendor_name")
      .eq("organization_id", organizationId)
      .in("id", vendorIdsForLabels.slice(0, BLITZPAY_AP_VENDOR_LIST_CAP))
    vendorNameById = new Map((vrows ?? []).map((v) => [(v as { id: string }).id, (v as { vendor_name: string }).vendor_name]))
  }
  const withVendorName = <T extends { vendor_id: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, vendor_name: vendorNameById.get(r.vendor_id) ?? null }))

  return {
    generatedAt: new Date().toISOString(),
    reporting: snap,
    treasuryOperatingCents: operating,
    treasuryCoveragePayablesBps: coverageBps,
    vendorConcentrationRisk0to100: concentration,
    payableAgingHealthScore0to100: agingScore,
    apCashOptimizationScore0to100: optScore,
    upcomingPayables: withVendorName(upcoming),
    approvalQueue: withVendorName(queue),
    recentPayRuns: runs ?? [],
    notes: [
      "Pay runs orchestrate what you plan to pay — they do not move money automatically.",
      "Stripe remains the path for card and bank payouts when you pay through approved flows.",
    ],
  }
}

export async function fetchApReportingSnapshotFields(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayApReportingFields> {
  assertUuid(organizationId, "organizationId")
  const defaults: BlitzpayApReportingFields = {
    accountsPayableOutstandingCents: 0,
    approvedBillsAwaitingPaymentCents: 0,
    overdueVendorBillsCents: 0,
    averageVendorPaymentDays: null,
    vendorConcentrationRisk: 0,
    treasuryCoverageForPayables: 0,
    payableAgingHealthScore: 0,
  }
  const today = new Date().toISOString().slice(0, 10)
  try {
    const { data: bills } = await admin
      .from("blitzpay_vendor_bills")
      .select("vendor_id, bill_status, due_date, remaining_balance_cents, approved_at")
      .eq("organization_id", organizationId)
      .limit(BLITZPAY_AP_BILL_LIST_CAP)
    const rows = bills ?? []
    let outstanding = 0
    let approvedAwait = 0
    let overdue = 0
    const vendorVals: number[] = []
    const vendorMap = new Map<string, number>()
    for (const r of rows as Array<{
      vendor_id: string
      bill_status: string
      due_date: string
      remaining_balance_cents: number
    }>) {
      const rem = Math.max(0, Math.round(r.remaining_balance_cents))
      if (rem <= 0) continue
      if (OPEN_AP_STATUSES.includes(r.bill_status as (typeof OPEN_AP_STATUSES)[number])) {
        outstanding += rem
      }
      if (["approved", "scheduled", "partially_paid"].includes(r.bill_status)) {
        approvedAwait += rem
      }
      if (r.due_date < today && ["pending_approval", "approved", "scheduled", "partially_paid", "disputed"].includes(r.bill_status)) {
        overdue += rem
      }
      vendorMap.set(r.vendor_id, (vendorMap.get(r.vendor_id) ?? 0) + rem)
    }
    for (const v of vendorMap.values()) vendorVals.push(v)

    const { data: allocs } = await admin
      .from("blitzpay_ap_payment_allocations")
      .select("allocated_at, metadata")
      .eq("organization_id", organizationId)
      .eq("allocation_status", "completed")
      .order("allocated_at", { ascending: false })
      .limit(80)
    const avgDays = computeAverageVendorPaymentDaysFromCompletedAllocations(
      (allocs ?? []) as Array<{ allocated_at: string | null; metadata: { bill_due_date?: string } | null }>,
      80,
    )

    let operating = 0
    try {
      const tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
      operating = tm.operatingBalanceCents
    } catch {
      operating = 0
    }
    const coverageBps = computeTreasuryCoverageForPayablesBps(operating, approvedAwait)
    const concentration = computeVendorConcentrationRisk0to100(vendorVals)
    const agingScore = computePayableAgingHealthScore0to100({
      overdueCents: overdue,
      totalOpenCents: outstanding,
      treasuryCoverageBps: coverageBps,
    })

    return {
      accountsPayableOutstandingCents: Math.min(9e12, outstanding),
      approvedBillsAwaitingPaymentCents: Math.min(9e12, approvedAwait),
      overdueVendorBillsCents: Math.min(9e12, overdue),
      averageVendorPaymentDays: avgDays,
      vendorConcentrationRisk: concentration,
      treasuryCoverageForPayables: coverageBps,
      payableAgingHealthScore: agingScore,
    }
  } catch {
    return defaults
  }
}
