import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { buildPayrollPeriodSummary } from "@/lib/blitzpay/blitzpay-payroll-engine"

export const PAYROLL_COMMISSION_SCAN_CAP = 500
export const PAYROLL_SETTLEMENT_SCAN_CAP = 300
export const PAYROLL_RUN_LIST_CAP = 60
export const PLATFORM_PAYROLL_ORG_SAMPLE_CAP = 80

export type BlitzpayPayrollRunRow = {
  id: string
  organization_id: string
  period_start: string
  period_end: string
  payroll_status: string
  total_payout_cents: number
  total_commission_cents: number
  technician_count: number
  processed_at: string | null
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function aggregateRunTotals(
  admin: SupabaseClient,
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ totalCommissionCents: number; technicianCount: number; settlementExposureCents: number }> {
  const startIso = `${periodStart}T00:00:00.000Z`
  const endIso = `${periodEnd}T23:59:59.999Z`

  const [{ data: commRows, error: cErr }, { data: setRows, error: sErr }] = await Promise.all([
    admin
      .from("blitzpay_work_order_commissions")
      .select("commission_cents, technician_user_id, commission_status, calculated_at")
      .eq("organization_id", organizationId)
      .gte("calculated_at", startIso)
      .lte("calculated_at", endIso)
      .in("commission_status", ["pending", "approved"])
      .limit(PAYROLL_COMMISSION_SCAN_CAP),
    admin
      .from("blitzpay_contractor_settlements")
      .select("amount_cents, settlement_status, created_at")
      .eq("organization_id", organizationId)
      .in("settlement_status", ["pending", "scheduled"])
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(PAYROLL_SETTLEMENT_SCAN_CAP),
  ])
  if (cErr) throw new Error(cErr.message)
  if (sErr) throw new Error(sErr.message)

  let totalCommissionCents = 0
  const tech = new Set<string>()
  for (const r of (commRows ?? []) as Array<{ commission_cents: number; technician_user_id: string; commission_status: string }>) {
    totalCommissionCents += Math.max(0, Math.round(Number(r.commission_cents) || 0))
    if (r.technician_user_id) tech.add(String(r.technician_user_id))
  }
  let settlementExposureCents = 0
  for (const r of (setRows ?? []) as Array<{ amount_cents: number }>) {
    settlementExposureCents += Math.max(0, Math.round(Number(r.amount_cents) || 0))
  }
  return {
    totalCommissionCents,
    technicianCount: tech.size,
    settlementExposureCents,
  }
}

export async function runDraftPayrollGeneration(
  admin: SupabaseClient,
  input: { organizationId: string; periodStart: string; periodEnd: string },
): Promise<BlitzpayPayrollRunRow> {
  assertUuid(input.organizationId, "organizationId")
  const ps = String(input.periodStart).slice(0, 10)
  const pe = String(input.periodEnd).slice(0, 10)
  if (ps > pe) throw new Error("periodStart must be on or before periodEnd.")

  const { data: existing, error: exErr } = await admin
    .from("blitzpay_payroll_runs")
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("period_start", ps)
    .eq("period_end", pe)
    .maybeSingle()
  if (exErr) throw new Error(exErr.message)
  if (existing) {
    const row = existing as BlitzpayPayrollRunRow
    const agg = await aggregateRunTotals(admin, input.organizationId, ps, pe)
    const totalPayout = Math.max(0, agg.totalCommissionCents + agg.settlementExposureCents)
    await admin
      .from("blitzpay_payroll_runs")
      .update({
        total_commission_cents: agg.totalCommissionCents,
        technician_count: agg.technicianCount,
        total_payout_cents: totalPayout,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    return { ...row, total_commission_cents: agg.totalCommissionCents, technician_count: agg.technicianCount, total_payout_cents: totalPayout }
  }

  const agg = await aggregateRunTotals(admin, input.organizationId, ps, pe)
  const totalPayout = Math.max(0, agg.totalCommissionCents + agg.settlementExposureCents)
  const { data: ins, error: iErr } = await admin
    .from("blitzpay_payroll_runs")
    .insert({
      organization_id: input.organizationId,
      period_start: ps,
      period_end: pe,
      payroll_status: "draft",
      total_commission_cents: agg.totalCommissionCents,
      technician_count: agg.technicianCount,
      total_payout_cents: totalPayout,
    })
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .single()
  if (iErr) throw new Error(iErr.message)
  return ins as BlitzpayPayrollRunRow
}

export async function approvePayrollRun(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<BlitzpayPayrollRunRow> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.runId, "runId")
  const { data: row, error } = await admin
    .from("blitzpay_payroll_runs")
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error("Payroll run not found.")
  if (String((row as { payroll_status: string }).payroll_status) !== "draft") {
    throw new Error("Only draft payroll runs can be approved.")
  }
  const { data: upd, error: uErr } = await admin
    .from("blitzpay_payroll_runs")
    .update({ payroll_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId)
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .single()
  if (uErr) throw new Error(uErr.message)
  const rowUpd = upd as BlitzpayPayrollRunRow
  const ps = rowUpd.period_start.slice(0, 10)
  const pe = rowUpd.period_end.slice(0, 10)
  const startIso = `${ps}T00:00:00.000Z`
  const endIso = `${pe}T23:59:59.999Z`
  const approveTs = new Date().toISOString()
  const { data: pendingIds, error: pidErr } = await admin
    .from("blitzpay_work_order_commissions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("commission_status", "pending")
    .gte("calculated_at", startIso)
    .lte("calculated_at", endIso)
    .limit(PAYROLL_COMMISSION_SCAN_CAP)
  if (pidErr) throw new Error(pidErr.message)
  const approveIds = (pendingIds ?? []).map((r) => String((r as { id: string }).id))
  if (approveIds.length > 0) {
    const { error: apErr } = await admin
      .from("blitzpay_work_order_commissions")
      .update({ commission_status: "approved", approved_at: approveTs, payroll_run_id: input.runId })
      .in("id", approveIds)
    if (apErr) throw new Error(apErr.message)
  }
  return rowUpd
}

export async function finalizePayrollRun(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<BlitzpayPayrollRunRow> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.runId, "runId")
  const { data: row, error } = await admin
    .from("blitzpay_payroll_runs")
    .select("id, payroll_status, period_start, period_end")
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error("Payroll run not found.")
  const st0 = String((row as { payroll_status: string }).payroll_status)
  if (st0 === "completed") {
    const { data: again, error: agErr } = await admin
      .from("blitzpay_payroll_runs")
      .select(
        "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
      )
      .eq("id", input.runId)
      .single()
    if (agErr || !again) throw new Error(agErr?.message || "Payroll run not found.")
    return again as BlitzpayPayrollRunRow
  }
  if (st0 !== "approved") {
    throw new Error("Only approved payroll runs can be finalized.")
  }
  const now = new Date().toISOString()

  await admin
    .from("blitzpay_payroll_runs")
    .update({ payroll_status: "processing", updated_at: now })
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId)

  const { data: commByRun, error: cpErr } = await admin
    .from("blitzpay_work_order_commissions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("payroll_run_id", input.runId)
    .eq("commission_status", "approved")
    .limit(PAYROLL_COMMISSION_SCAN_CAP)
  if (cpErr) throw new Error(cpErr.message)
  const ids = (commByRun ?? []).map((r) => String((r as { id: string }).id))
  if (ids.length > 0) {
    const { error: mark2 } = await admin
      .from("blitzpay_work_order_commissions")
      .update({
        commission_status: "paid",
        paid_at: now,
        payroll_run_id: input.runId,
        approved_at: now,
      })
      .in("id", ids)
    if (mark2) throw new Error(mark2.message)
  }

  const { data: fin, error: fErr } = await admin
    .from("blitzpay_payroll_runs")
    .update({
      payroll_status: "completed",
      processed_at: now,
      updated_at: now,
    })
    .eq("id", input.runId)
    .eq("organization_id", input.organizationId)
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .single()
  if (fErr) throw new Error(fErr.message)
  return fin as BlitzpayPayrollRunRow
}

export async function summarizePayrollHealth(admin: SupabaseClient, organizationId: string): Promise<{
  pendingCommissionCents: number
  pendingCommissionRowsApprox: number
  draftPayrollRuns: number
  failedPayrollRuns: number
  contractorSettlementPendingCents: number
  revenueSharePendingCents: number
  commissionVelocity7dCents: number
}> {
  assertUuid(organizationId, "organizationId")
  const since7 = ymd(new Date(Date.now() - 7 * 86400_000))

  const [{ data: pend, error: pErr }, { data: runs, error: rErr }, { data: setl, error: sErr }, { data: led, error: lErr }, { data: vel, error: vErr }] =
    await Promise.all([
      admin
        .from("blitzpay_work_order_commissions")
        .select("commission_cents")
        .eq("organization_id", organizationId)
        .eq("commission_status", "pending")
        .limit(200),
      admin
        .from("blitzpay_payroll_runs")
        .select("id, payroll_status")
        .eq("organization_id", organizationId)
        .in("payroll_status", ["draft", "failed"])
        .limit(PAYROLL_RUN_LIST_CAP),
      admin
        .from("blitzpay_contractor_settlements")
        .select("amount_cents")
        .eq("organization_id", organizationId)
        .in("settlement_status", ["pending", "scheduled"])
        .limit(200),
      admin
        .from("blitzpay_revenue_share_ledger")
        .select("share_cents")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .limit(200),
      admin
        .from("blitzpay_work_order_commissions")
        .select("commission_cents")
        .eq("organization_id", organizationId)
        .gte("calculated_at", `${since7}T00:00:00.000Z`)
        .limit(300),
    ])
  if (pErr) throw new Error(pErr.message)
  if (rErr) throw new Error(rErr.message)
  if (sErr) throw new Error(sErr.message)
  if (lErr) throw new Error(lErr.message)
  if (vErr) throw new Error(vErr.message)

  let pendingCommissionCents = 0
  for (const r of (pend ?? []) as Array<{ commission_cents: number }>) {
    pendingCommissionCents += Math.max(0, Math.round(Number(r.commission_cents) || 0))
  }
  let contractorSettlementPendingCents = 0
  for (const r of (setl ?? []) as Array<{ amount_cents: number }>) {
    contractorSettlementPendingCents += Math.max(0, Math.round(Number(r.amount_cents) || 0))
  }
  let revenueSharePendingCents = 0
  for (const r of (led ?? []) as Array<{ share_cents: number }>) {
    revenueSharePendingCents += Math.max(0, Math.round(Number(r.share_cents) || 0))
  }
  let commissionVelocity7dCents = 0
  for (const r of (vel ?? []) as Array<{ commission_cents: number }>) {
    commissionVelocity7dCents += Math.max(0, Math.round(Number(r.commission_cents) || 0))
  }

  const runList = (runs ?? []) as Array<{ payroll_status: string }>
  const draftPayrollRuns = runList.filter((x) => x.payroll_status === "draft").length
  const failedPayrollRuns = runList.filter((x) => x.payroll_status === "failed").length

  return {
    pendingCommissionCents,
    pendingCommissionRowsApprox: (pend as { length: number } | null)?.length ?? 0,
    draftPayrollRuns,
    failedPayrollRuns,
    contractorSettlementPendingCents,
    revenueSharePendingCents,
    commissionVelocity7dCents,
  }
}

export async function fetchBlitzpayPayrollDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  health: Awaited<ReturnType<typeof summarizePayrollHealth>>
  recentRuns: BlitzpayPayrollRunRow[]
  periodSummarySample: ReturnType<typeof buildPayrollPeriodSummary>
}> {
  const health = await summarizePayrollHealth(admin, organizationId)
  const { data: runRows, error } = await admin
    .from("blitzpay_payroll_runs")
    .select(
      "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
    )
    .eq("organization_id", organizationId)
    .order("period_end", { ascending: false })
    .limit(PAYROLL_RUN_LIST_CAP)
  if (error) throw new Error(error.message)

  const { data: commSample, error: csErr } = await admin
    .from("blitzpay_work_order_commissions")
    .select("technician_user_id, commission_cents, commission_status")
    .eq("organization_id", organizationId)
    .limit(120)
  if (csErr) throw new Error(csErr.message)
  const periodSummarySample = buildPayrollPeriodSummary(
    (commSample ?? []) as Array<{
      technician_user_id: string
      commission_cents: number
      commission_status: "pending" | "approved" | "paid" | "void"
    }>,
  )

  return {
    health,
    recentRuns: (runRows ?? []) as BlitzpayPayrollRunRow[],
    periodSummarySample,
  }
}

export async function listBlitzpayPayrollCommissions(
  admin: SupabaseClient,
  organizationId: string,
  opts?: { technicianUserId?: string | null; status?: string | null; workOrderId?: string | null; limit?: number },
): Promise<
  Array<{
    id: string
    work_order_id: string | null
    org_invoice_id: string
    technician_user_id: string
    revenue_basis_cents: number
    commission_cents: number
    commission_status: string
    calculated_at: string
  }>
> {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(200, Math.max(1, Math.round(Number(opts?.limit ?? 80))))
  let q = admin
    .from("blitzpay_work_order_commissions")
    .select(
      "id, work_order_id, org_invoice_id, technician_user_id, revenue_basis_cents, commission_cents, commission_status, calculated_at",
    )
    .eq("organization_id", organizationId)
    .order("calculated_at", { ascending: false })
    .limit(lim)
  const tech = opts?.technicianUserId?.trim()
  if (tech) q = q.eq("technician_user_id", tech)
  const wo = opts?.workOrderId?.trim()
  if (wo) q = q.eq("work_order_id", wo)
  const st = opts?.status?.trim()
  if (st) q = q.eq("commission_status", st)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    work_order_id: string | null
    org_invoice_id: string
    technician_user_id: string
    revenue_basis_cents: number
    commission_cents: number
    commission_status: string
    calculated_at: string
  }>
}

export async function listBlitzpayContractorSettlements(
  admin: SupabaseClient,
  organizationId: string,
  opts?: { limit?: number },
): Promise<
  Array<{
    id: string
    org_vendor_id: string | null
    work_order_id: string | null
    org_invoice_id: string | null
    settlement_type: string
    amount_cents: number
    settlement_status: string
    scheduled_for: string | null
    paid_at: string | null
  }>
> {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(200, Math.max(1, Math.round(Number(opts?.limit ?? 80))))
  const { data, error } = await admin
    .from("blitzpay_contractor_settlements")
    .select(
      "id, org_vendor_id, work_order_id, org_invoice_id, settlement_type, amount_cents, settlement_status, scheduled_for, paid_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    org_vendor_id: string | null
    work_order_id: string | null
    org_invoice_id: string | null
    settlement_type: string
    amount_cents: number
    settlement_status: string
    scheduled_for: string | null
    paid_at: string | null
  }>
}
