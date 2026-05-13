import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { IndustryBenchmarkMetricKey } from "@/lib/aiden/industry-operational-benchmark-types"
import { fetchIndustryOperationalMetrics } from "@/lib/aiden/industry-operational-metrics"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

const ACTIVE_STATUSES = ["open", "scheduled", "in_progress", "completed_pending_signature"] as const

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export type OrgOperationalBenchmarkSignals = Record<IndustryBenchmarkMetricKey, number | null>

/**
 * Bounded, org-local scalar signals used only for anonymous ratio math.
 * Callers must never forward raw customer or free-text fields to benchmark APIs.
 */
export async function collectOrgOperationalBenchmarkSignals(
  supabase: SupabaseClient,
  organizationId: string,
  industryKeyForMetrics: WorkspaceIndustryKey,
): Promise<OrgOperationalBenchmarkSignals> {
  const today = utcTodayYmd()
  const fourteenDaysAgo = daysAgoIso(14)
  const ninetyDaysAgo = daysAgoIso(90)

  function woWhere() {
    return supabase.from("work_orders").eq("organization_id", organizationId).is("archived_at", null)
  }

  const [
    activePlansRes,
    pastDuePlansRes,
    activeWoRes,
    pastSchedRes,
    agingRes,
    unassignedRes,
    wo90Res,
    invSampleRes,
  ] = await Promise.all([
    supabase
      .from("maintenance_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active"),
    supabase
      .from("maintenance_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .eq("status", "active")
      .not("next_due_date", "is", null)
      .lt("next_due_date", today),
    woWhere()
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES]),
    woWhere()
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "scheduled", "in_progress"])
      .not("scheduled_on", "is", null)
      .lt("scheduled_on", today),
    woWhere()
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES])
      .lt("updated_at", fourteenDaysAgo),
    woWhere()
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES])
      .is("assigned_user_id", null)
      .is("assigned_technician_id", null),
    woWhere()
      .select("id", { count: "exact", head: true })
      .gte("created_at", ninetyDaysAgo),
    supabase
      .from("org_invoices")
      .select("due_date, status")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["sent", "unpaid", "overdue"])
      .limit(500),
  ])

  const activePlans = activePlansRes.count ?? 0
  const pastDuePlans = pastDuePlansRes.count ?? 0
  const activeWo = activeWoRes.count ?? 0
  const pastSched = pastSchedRes.count ?? 0
  const aging = agingRes.count ?? 0
  const unassigned = unassignedRes.count ?? 0
  const wo90 = wo90Res.count ?? 0

  const pmBacklogRatio = activePlans > 0 ? pastDuePlans / activePlans : null
  const scheduleSlipRatio = activeWo > 0 ? pastSched / activeWo : null
  const staleRatio = activeWo > 0 ? aging / activeWo : null
  const unassignedRatio = activeWo > 0 ? unassigned / activeWo : null

  const metrics = await fetchIndustryOperationalMetrics(supabase, organizationId, {
    woIds: null,
    equipmentIds: null,
    assignedOnly: false,
  }, industryKeyForMetrics)

  const emergencyShare = wo90 > 0 ? metrics.workOrdersEmergency90d / wo90 : null
  const inspectionSlip = metrics.workOrdersInspectionActiveScheduledPast
  const repeatStress =
    metrics.equipmentTotal >= 1 ? metrics.emergencyRepeatEquipmentCount / metrics.equipmentTotal : null

  const invRows = (invSampleRes.data ?? []) as Array<{ due_date: string | null; status: string }>
  const openInv = invRows.length
  let overdueInv = 0
  for (const r of invRows) {
    if (r.status === "overdue") overdueInv += 1
    else if (r.due_date && r.due_date < today) overdueInv += 1
  }
  const invoiceOverdueRatio = openInv > 0 ? overdueInv / openInv : null

  return {
    pm_backlog_ratio: pmBacklogRatio,
    work_order_schedule_slip_ratio: scheduleSlipRatio,
    work_order_stale_ratio: staleRatio,
    dispatch_unassigned_ratio: unassignedRatio,
    emergency_work_share_90d: emergencyShare,
    inspection_slip_active_count: inspectionSlip,
    repeat_equipment_stress_index: repeatStress,
    invoice_overdue_ratio: invoiceOverdueRatio,
  }
}

export const BENCHMARK_METRIC_META: Record<
  IndustryBenchmarkMetricKey,
  { title: string; lowerIsBetter: boolean; description: string }
> = {
  pm_backlog_ratio: {
    title: "PM schedule pressure",
    lowerIsBetter: true,
    description: "Active maintenance plans past next due date ÷ active maintenance plans (same org scope).",
  },
  work_order_schedule_slip_ratio: {
    title: "Work order schedule slip",
    lowerIsBetter: true,
    description: "Active jobs past scheduled date ÷ active work orders.",
  },
  work_order_stale_ratio: {
    title: "Stale active work orders",
    lowerIsBetter: true,
    description: "Active jobs not updated in 14+ days ÷ active work orders.",
  },
  dispatch_unassigned_ratio: {
    title: "Dispatch backlog (unassigned)",
    lowerIsBetter: true,
    description: "Active jobs without primary assignee ÷ active work orders.",
  },
  emergency_work_share_90d: {
    title: "Emergency work share (90d)",
    lowerIsBetter: true,
    description: "Emergency-type work orders created in 90d ÷ all work orders created in 90d.",
  },
  inspection_slip_active_count: {
    title: "Inspection jobs past scheduled date",
    lowerIsBetter: true,
    description: "Count of active inspection-type jobs whose scheduled date is already in the past (UTC).",
  },
  repeat_equipment_stress_index: {
    title: "Repeat equipment stress (90d)",
    lowerIsBetter: true,
    description: "Equipment with ≥2 emergency-type work orders in 90d ÷ sampled equipment rows.",
  },
  invoice_overdue_ratio: {
    title: "Open invoice overdue pressure",
    lowerIsBetter: true,
    description: "Open sent/unpaid/overdue invoices that are overdue by status or due date ÷ all open invoice rows in sample.",
  },
}
