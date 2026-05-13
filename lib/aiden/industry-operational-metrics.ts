import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import { getIndustryOperationalProfile } from "@/lib/aiden/industry-operational-profiles"

const ACTIVE_STATUSES = ["open", "scheduled", "in_progress", "completed_pending_signature"] as const

export type IndustryOperationalMetrics = {
  equipmentTotal: number
  equipmentActive: number
  equipmentInRepairOrOos: number
  workOrdersEmergency90d: number
  /** Equipment with ≥2 emergency-type WOs created in the last 90 days (non-null equipment_id). */
  emergencyRepeatEquipmentCount: number
  workOrdersCriticalOrHighOpen: number
  workOrdersInspectionActiveScheduledPast: number
  workOrdersPmType90d: number
  workOrdersInspectionType90d: number
  equipmentBatteryNameOrCategoryHits: number
  equipmentCalibrationDueInWindow: number
  /** Title keyword hits keyed by signal id (see industry profile). */
  titleKeywordHits90d: Record<string, number>
}

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

type Scope = {
  woIds: string[] | null
  equipmentIds: string[] | null
  assignedOnly: boolean
}

function scanTitleKeywords(
  titles: string[],
  signals: { id: string; anySubstrings: string[] }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of signals) out[s.id] = 0
  for (const raw of titles) {
    const t = raw.toLowerCase()
    for (const s of signals) {
      if (s.anySubstrings.some((sub) => t.includes(sub.toLowerCase()))) {
        out[s.id] = (out[s.id] ?? 0) + 1
      }
    }
  }
  return out
}

/**
 * Bounded, org-scoped metrics used for deterministic industry heuristics (same RLS as caller).
 */
export async function fetchIndustryOperationalMetrics(
  supabase: SupabaseClient,
  organizationId: string,
  scope: Scope,
  industryKey: WorkspaceIndustryKey,
): Promise<IndustryOperationalMetrics> {
  const today = utcTodayYmd()
  const ninetyDaysAgo = daysAgoIso(90)
  const sevenDaysAhead = new Date()
  sevenDaysAhead.setUTCDate(sevenDaysAhead.getUTCDate() + 7)
  const weekAheadYmd = sevenDaysAhead.toISOString().slice(0, 10)

  const profile = getIndustryOperationalProfile(industryKey)

  function woWhere() {
    let q = supabase.from("work_orders").eq("organization_id", organizationId).is("archived_at", null)
    if (scope.woIds && scope.woIds.length > 0) q = q.in("id", scope.woIds)
    return q
  }

  const assignedNoEquip = scope.assignedOnly && (!scope.equipmentIds || scope.equipmentIds.length === 0)

  const [
    emergency90CountRes,
    emergency90EquipRowsRes,
    critOpenRes,
    inspectionPastRes,
    pmType90Res,
    inspectionType90Res,
    titleRowsRes,
    equipRowsRes,
  ] = await Promise.all([
    woWhere()
      .select("id", { count: "exact", head: true })
      .eq("type", "emergency")
      .gte("created_at", ninetyDaysAgo),
    woWhere()
      .select("equipment_id")
      .eq("type", "emergency")
      .gte("created_at", ninetyDaysAgo)
      .not("equipment_id", "is", null)
      .limit(800),
    woWhere()
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_STATUSES])
      .in("priority", ["critical", "high"]),
    woWhere()
      .select("id", { count: "exact", head: true })
      .eq("type", "inspection")
      .in("status", ["open", "scheduled", "in_progress"])
      .not("scheduled_on", "is", null)
      .lt("scheduled_on", today),
    woWhere()
      .select("id", { count: "exact", head: true })
      .eq("type", "pm")
      .gte("created_at", ninetyDaysAgo),
    woWhere()
      .select("id", { count: "exact", head: true })
      .eq("type", "inspection")
      .gte("created_at", ninetyDaysAgo),
    woWhere()
      .select("title")
      .gte("created_at", ninetyDaysAgo)
      .limit(600),
    assignedNoEquip ?
      Promise.resolve({ data: [] as { status: string; name: string; category: string | null }[] })
    : (() => {
        let q = supabase
          .from("equipment")
          .select("status, name, category, next_calibration_due_at")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .limit(1200)
        if (scope.assignedOnly && scope.equipmentIds && scope.equipmentIds.length > 0) {
          q = q.in("id", scope.equipmentIds)
        }
        return q
      })(),
  ])

  const emergencyRows = (emergency90EquipRowsRes.data ?? []) as Array<{ equipment_id: string | null }>
  const emergencyCount = emergency90CountRes.count ?? 0
  const byEquip = new Map<string, number>()
  for (const r of emergencyRows) {
    if (!r.equipment_id) continue
    byEquip.set(r.equipment_id, (byEquip.get(r.equipment_id) ?? 0) + 1)
  }
  let emergencyRepeatEquipmentCount = 0
  for (const n of byEquip.values()) {
    if (n >= 2) emergencyRepeatEquipmentCount += 1
  }

  const titleRows = (titleRowsRes.data ?? []) as Array<{ title: string | null }>
  const titles = titleRows.map((r) => (r.title ?? "").trim()).filter(Boolean)
  const titleKeywordHits90d = scanTitleKeywords(titles, profile.titleKeywordSignals)

  const equipRows = (equipRowsRes.data ?? []) as Array<{
    status: string
    name: string
    category: string | null
    next_calibration_due_at: string | null
  }>
  let equipmentTotal = 0
  let equipmentActive = 0
  let equipmentInRepairOrOos = 0
  let equipmentBatteryNameOrCategoryHits = 0
  let equipmentCalibrationDueInWindow = 0
  for (const e of equipRows) {
    equipmentTotal += 1
    if (e.status === "active") equipmentActive += 1
    if (e.status === "in_repair" || e.status === "out_of_service") equipmentInRepairOrOos += 1
    const blob = `${e.name} ${e.category ?? ""}`.toLowerCase()
    if (blob.includes("battery")) equipmentBatteryNameOrCategoryHits += 1
    if (e.next_calibration_due_at && e.next_calibration_due_at <= weekAheadYmd) {
      equipmentCalibrationDueInWindow += 1
    }
  }

  return {
    equipmentTotal,
    equipmentActive,
    equipmentInRepairOrOos,
    workOrdersEmergency90d: emergencyCount,
    emergencyRepeatEquipmentCount,
    workOrdersCriticalOrHighOpen: critOpenRes.count ?? 0,
    workOrdersInspectionActiveScheduledPast: inspectionPastRes.count ?? 0,
    workOrdersPmType90d: pmType90Res.count ?? 0,
    workOrdersInspectionType90d: inspectionType90Res.count ?? 0,
    equipmentBatteryNameOrCategoryHits,
    equipmentCalibrationDueInWindow,
    titleKeywordHits90d,
  }
}

export type CountsSlice = {
  maintenancePlansPastDue: number
  agingActiveWorkOrdersUpdatedBefore14d: number
  scheduledDatePassedStillActive: number
  repeatEquipmentPatterns?: Array<{ equipmentId: string; workOrdersInWindow: number }>
}

export { buildIndustryOperationalBrief } from "@/lib/aiden/build-industry-operational-brief"
