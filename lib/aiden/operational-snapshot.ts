import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"
import type { OrgPermissions } from "@/lib/permissions/model"
import { isAssignedWorkOnly, type AssignedWorkScope } from "@/lib/permissions/technician-scope"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import {
  buildIndustryOperationalBrief,
  fetchIndustryOperationalMetrics,
} from "@/lib/aiden/industry-operational-metrics"
import { buildOperationalHealthScores } from "@/lib/aiden/operational-health-scores"
import { buildOperationalTimelineIntelligenceForOrg } from "@/lib/aiden/operational-timeline-intelligence"

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

const ACTIVE_STATUSES = ["open", "scheduled", "in_progress", "completed_pending_signature"] as const

type SnapshotArgs = {
  organizationId: string
  permissions: OrgPermissions
  assignedScope: AssignedWorkScope | null
  moduleContext: OperationalModuleContext
  includeFinancialHints: boolean
  /** Normalized workspace vertical — enables deterministic industry heuristics in snapshot. */
  industryKey?: WorkspaceIndustryKey | null
}

/** Shared with executive reporting — same bounded WO id list as operational snapshots. */
export function workOrderScopeForAssignedTechnicians(
  permissions: OrgPermissions,
  assignedScope: AssignedWorkScope | null,
): { skip: boolean; woIds: string[] | null } {
  if (!isAssignedWorkOnly(permissions)) {
    return { skip: false, woIds: null }
  }
  const ids = assignedScope?.workOrderIds ?? []
  if (ids.length === 0) {
    return { skip: true, woIds: [] }
  }
  return { skip: false, woIds: ids }
}

function scopeFilters(args: SnapshotArgs): { skip: boolean; woIds: string[] | null } {
  return workOrderScopeForAssignedTechnicians(args.permissions, args.assignedScope)
}

/**
 * Bounded, read-only aggregates for operational AI — no bulk sensitive dumps.
 */
export async function buildOperationalSnapshot(
  supabase: SupabaseClient,
  args: SnapshotArgs,
): Promise<Record<string, unknown>> {
  const today = utcTodayYmd()
  const fourteenDaysAgo = daysAgoIso(14)
  const ninetyDaysAgo = daysAgoIso(90)
  const sevenDaysAhead = new Date()
  sevenDaysAhead.setUTCDate(sevenDaysAhead.getUTCDate() + 7)
  const weekAheadYmd = sevenDaysAhead.toISOString().slice(0, 10)

  const scope = scopeFilters(args)
  if (scope.skip) {
    return {
      generatedAt: new Date().toISOString(),
      moduleContext: args.moduleContext,
      scope: "assigned_empty",
      summary: { note: "No assigned work orders in scope for this user." },
    }
  }

  const orgId = args.organizationId
  const assigned = isAssignedWorkOnly(args.permissions)
  const equipIds = assigned ? args.assignedScope?.equipmentIds ?? [] : null
  const generatedAt = new Date().toISOString()
  const timelineCreatedAfterIso = daysAgoIso(120)

  function woQuery(select: string, selectOpts?: { count: "exact" | "planned" | "estimated"; head?: boolean }) {
    let q = supabase
      .from("work_orders")
      .select(select, selectOpts)
      .eq("organization_id", orgId)
      .is("archived_at", null)
    if (scope.woIds) q = q.in("id", scope.woIds)
    return q
  }

  const plansDuePromise =
    assigned && (!equipIds || equipIds.length === 0) ?
      Promise.resolve({ count: 0 } as { count: number | null })
    : (() => {
        let plansOverdueQuery = supabase
          .from("maintenance_plans")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .eq("status", "active")
          .not("next_due_date", "is", null)
          .lt("next_due_date", today)
        if (assigned && equipIds && equipIds.length > 0) {
          plansOverdueQuery = plansOverdueQuery.in("equipment_id", equipIds)
        }
        return plansOverdueQuery
      })()

  const equipDuePromise =
    assigned && (!equipIds || equipIds.length === 0) ?
      Promise.resolve({ data: [] as unknown[] })
    : (() => {
        let equipmentDueQuery = supabase
          .from("equipment")
          .select("id, next_due_at, next_calibration_due_at, customer_id")
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .or(`next_due_at.lte.${weekAheadYmd},next_calibration_due_at.lte.${weekAheadYmd}`)
          .limit(80)
        if (assigned && equipIds && equipIds.length > 0) {
          equipmentDueQuery = equipmentDueQuery.in("id", equipIds)
        }
        return equipmentDueQuery
      })()

  const [
    agingRes,
    pastScheduledRes,
    unassignedRes,
    activeWoSampleRes,
    repeatWoRes,
    equipDueRes,
    plansOverdueRes,
    scheduleDensityRes,
    operationalTimelineIntelligence,
  ] = await Promise.all([
    woQuery("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES])
      .lt("updated_at", `${fourteenDaysAgo}`),
    woQuery("id", { count: "exact", head: true })
      .in("status", ["open", "scheduled", "in_progress"])
      .not("scheduled_on", "is", null)
      .lt("scheduled_on", today),
    woQuery("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES])
      .is("assigned_user_id", null)
      .is("assigned_technician_id", null),
    woQuery("id, customer_id, equipment_id, status, scheduled_on, updated_at")
      .in("status", [...ACTIVE_STATUSES])
      .order("updated_at", { ascending: true })
      .limit(40),
    woQuery("equipment_id")
      .gte("created_at", ninetyDaysAgo)
      .not("equipment_id", "is", null),
    equipDuePromise,
    plansDuePromise,
    woQuery("scheduled_on, assigned_user_id, assigned_technician_id")
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_on", today)
      .lte("scheduled_on", weekAheadYmd)
      .limit(400),
    buildOperationalTimelineIntelligenceForOrg(supabase, {
      organizationId: orgId,
      woIds: scope.woIds,
      industryKey: args.industryKey ?? null,
      createdAfterIso: timelineCreatedAfterIso,
      rowLimit: 400,
      generatedAtIso: generatedAt,
    }),
  ])

  const activeRows = (activeWoSampleRes.data ?? []) as Array<{
    id: string
    customer_id: string
    equipment_id: string | null
    status: string
    scheduled_on: string | null
    updated_at: string
  }>

  const customerCounts = new Map<string, number>()
  for (const r of activeRows) {
    customerCounts.set(r.customer_id, (customerCounts.get(r.customer_id) ?? 0) + 1)
  }
  const topCustomersUnresolved = [...customerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([customerId, openJobs]) => ({ customerId, openJobs }))

  const repeatRows = (repeatWoRes.data ?? []) as Array<{ equipment_id: string | null }>
  const eqCounts = new Map<string, number>()
  for (const r of repeatRows) {
    if (!r.equipment_id) continue
    eqCounts.set(r.equipment_id, (eqCounts.get(r.equipment_id) ?? 0) + 1)
  }
  const repeatEquipment = [...eqCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([equipmentId, workOrdersInWindow]) => ({ equipmentId, workOrdersInWindow }))

  const densityRows = (scheduleDensityRes.data ?? []) as Array<{
    scheduled_on: string | null
    assigned_user_id: string | null
    assigned_technician_id: string | null
  }>
  const dayTech = new Map<string, number>()
  for (const r of densityRows) {
    const day = r.scheduled_on ?? ""
    const tech = r.assigned_technician_id ?? r.assigned_user_id ?? "unassigned"
    const k = `${day}|${tech}`
    dayTech.set(k, (dayTech.get(k) ?? 0) + 1)
  }
  let maxSameDaySameTech = 0
  for (const n of dayTech.values()) maxSameDaySameTech = Math.max(maxSameDaySameTech, n)
  const scheduleHotspots = [...dayTech.entries()]
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => {
      const [scheduledOn, techKey] = key.split("|")
      return { scheduledOn, assigneeKey: techKey, jobsThatDay: count }
    })

  const equipRows = (equipDueRes.data ?? []) as Array<{
    id: string
    next_due_at: string | null
    next_calibration_due_at: string | null
    customer_id: string | null
  }>
  const equipmentDueRisk = equipRows.slice(0, 25).map((e) => ({
    equipmentId: e.id,
    customerId: e.customer_id,
    nextDueAt: e.next_due_at,
    nextCalibrationDueAt: e.next_calibration_due_at,
  }))

  let overdueInvoiceCount: number | undefined
  if (args.includeFinancialHints) {
    const { data: inv } = await supabase
      .from("org_invoices")
      .select("due_date, status")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .in("status", ["sent", "unpaid", "overdue"])
      .limit(500)
    const rows = (inv ?? []) as Array<{ due_date: string | null; status: string }>
    overdueInvoiceCount = rows.filter((r) => {
      if (!r.due_date) return r.status === "overdue"
      return r.due_date < today
    }).length
  }

  const countsBlock = {
    agingActiveWorkOrdersUpdatedBefore14d: agingRes.count ?? 0,
    scheduledDatePassedStillActive: pastScheduledRes.count ?? 0,
    activeWorkOrdersUnassigned: unassignedRes.count ?? 0,
    maintenancePlansPastDue: plansOverdueRes.count ?? 0,
    maxJobsSameDaySameAssignee: maxSameDaySameTech,
  }

  const base: Record<string, unknown> = {
    generatedAt,
    moduleContext: args.moduleContext,
    scope: scope.woIds ? "assigned_only" : "organization",
    todayUtc: today,
    counts: countsBlock,
    samples: {
      oldestActiveWorkOrderIds: activeRows.slice(0, 15).map((r) => r.id),
      topCustomersWithUnresolvedWork: topCustomersUnresolved,
      repeatEquipmentPatterns: repeatEquipment,
      scheduleCongestionExamples: scheduleHotspots,
      equipmentDueSoonOrPast: equipmentDueRisk,
    },
    financialHints:
      args.includeFinancialHints && overdueInvoiceCount !== undefined ?
        { overdueInvoiceCount }
      : undefined,
    operationalTimelineIntelligence,
  }

  const metricsSamplingIndustry = args.industryKey ?? "field_service"
  const industryMetrics = await fetchIndustryOperationalMetrics(
    supabase,
    orgId,
    { woIds: scope.woIds, equipmentIds: equipIds, assignedOnly: assigned },
    metricsSamplingIndustry,
  )

  const healthCounts = {
    ...countsBlock,
    repeatEquipmentPatterns: repeatEquipment,
  }
  base.operationalHealthScores = buildOperationalHealthScores({
    generatedAt,
    industryKey: args.industryKey ?? null,
    metricsSamplingIndustryKey: args.industryKey ? undefined : metricsSamplingIndustry,
    metrics: industryMetrics,
    counts: healthCounts,
    overdueInvoiceCount:
      args.includeFinancialHints && overdueInvoiceCount !== undefined ? overdueInvoiceCount : undefined,
  })

  if (args.industryKey) {
    base.industryOperational = buildIndustryOperationalBrief({
      industryKey: args.industryKey,
      moduleContext: args.moduleContext,
      metrics: industryMetrics,
      counts: healthCounts,
    })
  }

  return base
}
