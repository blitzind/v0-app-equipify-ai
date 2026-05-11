import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

const WO_SCAN_LIMIT = 120
const QUOTE_SCAN_LIMIT = 80

export type BlitzpayWorkflowCashPipelineSnapshot = {
  /** Work orders in a completed-like state in the scanned sample missing any linked invoice. */
  completedWorkOrdersWithoutInvoiceSampleCount: number
  completedWorkOrdersScanned: number
  /** Open quotes with positive totals (bounded sample) that are not converted. */
  openQuotesWithBalanceSampleCount: number
  /** Quotes in sample with deposit collected > 0 still open (deposit-before-work signal). */
  openQuotesWithDepositNotConvertedSampleCount: number
  /** From reporting window: field “invoice later” markers. */
  workOrdersFieldInvoiceLaterWindowCount: number
  /** Active maintenance plans for org (count only). */
  activeMaintenancePlansCount: number
  /** Suggested actions (deterministic, no execution). */
  cashAccelerationOpportunities: string[]
  operationalLeakageNotes: string[]
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

/**
 * Bounded, explainable WO → cash pipeline signals (no LLM).
 */
export async function fetchWorkflowCashPipelineSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  options: { sinceIso: string; fieldInvoiceLaterWindowCount: number },
): Promise<BlitzpayWorkflowCashPipelineSnapshot> {
  assertUuid(organizationId, "organizationId")
  const sinceIso = options.sinceIso

  let completedWorkOrdersScanned = 0
  let completedWorkOrdersWithoutInvoiceSampleCount = 0
  let openQuotesWithBalanceSampleCount = 0
  let openQuotesWithDepositNotConvertedSampleCount = 0
  let activeMaintenancePlansCount = 0

  try {
    const { count, error: mpErr } = await admin
      .from("maintenance_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
    if (!mpErr && count != null) activeMaintenancePlansCount = count
  } catch {
    activeMaintenancePlansCount = 0
  }

  try {
    const { data: wos, error: woErr } = await admin
      .from("work_orders")
      .select("id, status")
      .eq("organization_id", organizationId)
      .in("status", ["completed", "completed_pending_signature"])
      .order("updated_at", { ascending: false })
      .limit(WO_SCAN_LIMIT)
    if (!woErr && wos?.length) {
      const woRows = wos as Array<{ id: string; status: string }>
      completedWorkOrdersScanned = woRows.length
      const ids = woRows.map((w) => w.id)
      const linked = new Set<string>()
      const chunk = 60
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk)
        const [{ data: l1 }, { data: l2 }] = await Promise.all([
          admin.from("invoice_work_order_links").select("work_order_id").eq("organization_id", organizationId).in("work_order_id", slice),
          admin.from("org_invoices").select("work_order_id").eq("organization_id", organizationId).in("work_order_id", slice),
        ])
        for (const r of (l1 ?? []) as Array<{ work_order_id: string }>) {
          if (r.work_order_id) linked.add(r.work_order_id)
        }
        for (const r of (l2 ?? []) as Array<{ work_order_id: string | null }>) {
          if (r.work_order_id) linked.add(r.work_order_id)
        }
      }
      completedWorkOrdersWithoutInvoiceSampleCount = ids.filter((id) => !linked.has(id)).length
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: quotes, error: qErr } = await admin
      .from("org_quotes")
      .select("id, status, amount_cents, blitzpay_deposit_collected_cents, blitzpay_converted_invoice_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(QUOTE_SCAN_LIMIT)
    if (!qErr && quotes?.length) {
      const rows = quotes as Array<{
        id: string
        status: string
        amount_cents: number | null
        blitzpay_deposit_collected_cents: number | null
        blitzpay_converted_invoice_id: string | null
      }>
      for (const q of rows) {
        const st = String(q.status || "").toLowerCase()
        const openLike = !q.blitzpay_converted_invoice_id && st !== "declined" && st !== "void" && st !== "expired"
        if (!openLike) continue
        const amt = Math.max(0, Math.round(Number(q.amount_cents ?? 0)))
        if (amt > 0) openQuotesWithBalanceSampleCount += 1
        const dep = Math.max(0, Math.round(Number(q.blitzpay_deposit_collected_cents ?? 0)))
        if (dep > 0) openQuotesWithDepositNotConvertedSampleCount += 1
      }
    }
  } catch {
    /* ignore */
  }

  const cashAccelerationOpportunities: string[] = []
  const operationalLeakageNotes: string[] = []

  if (completedWorkOrdersWithoutInvoiceSampleCount > 0) {
    operationalLeakageNotes.push(
      `In a recent sample of ${completedWorkOrdersScanned} completed work orders, ${completedWorkOrdersWithoutInvoiceSampleCount} had no linked invoice yet — billing may be lagging completed field work.`,
    )
    cashAccelerationOpportunities.push("Invoice completed jobs that are still missing invoice links to tighten service-to-cash timing.")
  }
  if (options.fieldInvoiceLaterWindowCount > 0) {
    operationalLeakageNotes.push(
      `${options.fieldInvoiceLaterWindowCount} work order(s) had “invoice later” marked in the reporting window — follow up so billing is not deferred.`,
    )
  }
  if (openQuotesWithDepositNotConvertedSampleCount > 0) {
    cashAccelerationOpportunities.push(
      `${openQuotesWithDepositNotConvertedSampleCount} open quote(s) in sample already collected a deposit — prioritize scheduling or conversion to reduce deposit idle time.`,
    )
  }
  if (activeMaintenancePlansCount > 0 && completedWorkOrdersWithoutInvoiceSampleCount > 2) {
    cashAccelerationOpportunities.push(
      "Recurring maintenance plans are active — pairing tighter invoicing with PM visits can stabilize predictable cash inflows.",
    )
  }

  return {
    completedWorkOrdersWithoutInvoiceSampleCount,
    completedWorkOrdersScanned,
    openQuotesWithBalanceSampleCount,
    openQuotesWithDepositNotConvertedSampleCount,
    workOrdersFieldInvoiceLaterWindowCount: options.fieldInvoiceLaterWindowCount,
    activeMaintenancePlansCount,
    cashAccelerationOpportunities: unique(cashAccelerationOpportunities),
    operationalLeakageNotes: unique(operationalLeakageNotes),
  }
}
