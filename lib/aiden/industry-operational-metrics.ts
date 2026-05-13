import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { DeterministicIndustryInsight, IndustryOperationalBrief } from "@/lib/aiden/industry-operational-public-types"
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

type CountsSlice = {
  maintenancePlansPastDue: number
  agingActiveWorkOrdersUpdatedBefore14d: number
  scheduledDatePassedStillActive: number
  repeatEquipmentPatterns?: Array<{ equipmentId: string; workOrdersInWindow: number }>
}

export function buildIndustryOperationalBrief(args: {
  industryKey: WorkspaceIndustryKey
  moduleContext: OperationalModuleContext
  metrics: IndustryOperationalMetrics
  counts: CountsSlice
}): IndustryOperationalBrief {
  const profile = getIndustryOperationalProfile(args.industryKey)
  const { metrics, counts } = args

  const dashboardSummaryLines: string[] = []
  const maintenanceSummaryLines: string[] = []
  const deterministicInsights: DeterministicIndustryInsight[] = []

  const pushUnique = (arr: string[], line: string) => {
    if (!arr.includes(line)) arr.push(line)
  }

  if (counts.maintenancePlansPastDue > 0) {
    pushUnique(
      dashboardSummaryLines,
      `${counts.maintenancePlansPastDue} active maintenance plan(s) have a next due date in the past — review PM coverage vs technician capacity.`,
    )
    pushUnique(
      maintenanceSummaryLines,
      `Past-due PM plans: ${counts.maintenancePlansPastDue}. Reconcile schedules before adding new agreements.`,
    )
  }

  if (counts.agingActiveWorkOrdersUpdatedBefore14d > 0) {
    pushUnique(
      dashboardSummaryLines,
      `${counts.agingActiveWorkOrdersUpdatedBefore14d} active work order(s) have not been updated in 14+ days — triage stalled jobs.`,
    )
  }

  if (counts.scheduledDatePassedStillActive > 0) {
    pushUnique(
      dashboardSummaryLines,
      `${counts.scheduledDatePassedStillActive} active work order(s) have a scheduled date in the past — reschedule or close out.`,
    )
  }

  // --- Industry-specific deterministic cards (threshold + explicit evidence) ---
  if (args.industryKey === "refrigeration_service") {
    if (metrics.emergencyRepeatEquipmentCount >= 1) {
      deterministicInsights.push({
        id: "ref_repeat_emergency_equipment",
        title: "Repeat emergency work on the same equipment",
        detail:
          "Multiple emergency-type work orders in the last 90 days reference the same equipment id at least twice. Review asset history before declaring the rack or case stable.",
        severity: metrics.emergencyRepeatEquipmentCount >= 3 ? "high" : "medium",
        evidence: [
          `Equipment with ≥2 emergency work orders (90d): ${metrics.emergencyRepeatEquipmentCount}`,
          `Emergency-type work orders (90d): ${metrics.workOrdersEmergency90d}`,
        ],
      })
    }
    const leakHits = metrics.titleKeywordHits90d.refrigerant_leak_vocab ?? 0
    if (leakHits >= 2) {
      deterministicInsights.push({
        id: "ref_title_leak_vocab",
        title: "Work order titles mention refrigerant or leak language",
        detail:
          "Counts are from substring matches on work order titles in the last 90 days — not a confirmed leak diagnosis.",
        severity: leakHits >= 6 ? "high" : "medium",
        evidence: [`Title keyword matches (90d, OR vocabulary): ${leakHits}`],
      })
    }
    if (
      (args.moduleContext === "maintenance_plans" || args.moduleContext === "dashboard") &&
      counts.maintenancePlansPastDue > 0
    ) {
      deterministicInsights.push({
        id: "ref_pm_past_due",
        title: "Refrigeration PM plans are past due",
        detail:
          "Past-due PM plan rows are factual schedule debt — align compressor/rack PM visits with the dates already stored on plans.",
        severity: counts.maintenancePlansPastDue >= 5 ? "high" : "medium",
        evidence: [`Active maintenance plans past next due date: ${counts.maintenancePlansPastDue}`],
      })
    }
  }

  if (args.industryKey === "equipment_rental") {
    if (metrics.equipmentTotal >= 4) {
      const readiness = metrics.equipmentTotal > 0 ? metrics.equipmentActive / metrics.equipmentTotal : 1
      if (readiness < 0.55) {
        deterministicInsights.push({
          id: "rental_readiness_mix",
          title: "Low share of equipment marked active",
          detail:
            "Readiness is approximated from equipment status flags in the register (active vs in_repair/out_of_service) — not a rental contract metric.",
          severity: readiness < 0.35 ? "high" : "medium",
          evidence: [
            `Equipment rows sampled: ${metrics.equipmentTotal}`,
            `Status=active: ${metrics.equipmentActive}`,
            `Status in in_repair or out_of_service: ${metrics.equipmentInRepairOrOos}`,
          ],
        })
      }
    }
    if (metrics.workOrdersInspectionActiveScheduledPast > 0) {
      deterministicInsights.push({
        id: "rental_inspection_past_due",
        title: "Inspection jobs past scheduled date still active",
        detail:
          "Counts inspection-type work orders that remain non-terminal while `scheduled_on` is before today — common turnaround choke point.",
        severity: metrics.workOrdersInspectionActiveScheduledPast >= 4 ? "high" : "medium",
        evidence: [`Inspection-type active jobs past scheduled date: ${metrics.workOrdersInspectionActiveScheduledPast}`],
      })
    }
  }

  if (args.industryKey === "material_handling") {
    if (metrics.workOrdersInspectionActiveScheduledPast > 0) {
      deterministicInsights.push({
        id: "mh_inspection_backlog",
        title: "Inspection work is behind scheduled dates",
        detail:
          "Non-terminal inspection jobs with a scheduled date in the past indicate a compliance or yard queue risk for industrial trucks.",
        severity: metrics.workOrdersInspectionActiveScheduledPast >= 3 ? "high" : "medium",
        evidence: [`Inspection-type active jobs past scheduled date: ${metrics.workOrdersInspectionActiveScheduledPast}`],
      })
    }
    const forkHits = metrics.titleKeywordHits90d.forklift_vocab ?? 0
    if (forkHits >= 1 && metrics.workOrdersInspectionType90d < metrics.workOrdersPmType90d) {
      deterministicInsights.push({
        id: "mh_forklift_vocab_vs_pm",
        title: "Forklift wording in titles with relatively fewer inspection jobs logged",
        detail:
          "Compares 90d title keyword hits for forklift vocabulary against inspection-type vs PM-type work order counts — directional only.",
        severity: "low",
        evidence: [
          `Forklift vocabulary hits in titles (90d): ${forkHits}`,
          `Inspection-type work orders created (90d): ${metrics.workOrdersInspectionType90d}`,
          `PM-type work orders created (90d): ${metrics.workOrdersPmType90d}`,
        ],
      })
    }
    if (metrics.equipmentBatteryNameOrCategoryHits >= 1 && counts.maintenancePlansPastDue > 0) {
      deterministicInsights.push({
        id: "mh_battery_pm_pressure",
        title: "Battery-named assets present while PM plans are late",
        detail:
          "Battery mentions come from equipment name/category text in the sampled register — pair with past-due PM counts as a planning cue.",
        severity: "medium",
        evidence: [
          `Equipment rows in sample mentioning “battery”: ${metrics.equipmentBatteryNameOrCategoryHits}`,
          `Past-due PM plans: ${counts.maintenancePlansPastDue}`,
        ],
      })
    }
  }

  if (args.industryKey === "generator_power") {
    const atsHits = metrics.titleKeywordHits90d.ats_vocab ?? 0
    const exerciseHits = metrics.titleKeywordHits90d.exercise_vocab ?? 0
    if (metrics.workOrdersInspectionActiveScheduledPast > 0 && (atsHits >= 1 || exerciseHits >= 1)) {
      deterministicInsights.push({
        id: "gen_inspection_plus_vocab",
        title: "Inspection backlog with ATS or exercise wording in recent titles",
        detail:
          "Vocabulary hits are title substring matches only. Inspection date slippage is factual from scheduled vs status fields.",
        severity: metrics.workOrdersInspectionActiveScheduledPast >= 3 ? "high" : "medium",
        evidence: [
          `Inspection-type active jobs past scheduled date: ${metrics.workOrdersInspectionActiveScheduledPast}`,
          `ATS vocabulary hits in titles (90d): ${atsHits}`,
          `Exercise vocabulary hits in titles (90d): ${exerciseHits}`,
        ],
      })
    } else if (metrics.workOrdersInspectionActiveScheduledPast >= 3) {
      deterministicInsights.push({
        id: "gen_inspection_backlog_only",
        title: "Multiple inspection jobs are behind their scheduled dates",
        detail: "Uses inspection-type work orders with scheduled dates in the past that are still active.",
        severity: "high",
        evidence: [`Inspection-type active jobs past scheduled date: ${metrics.workOrdersInspectionActiveScheduledPast}`],
      })
    }
    const lb = metrics.titleKeywordHits90d.load_bank_vocab ?? 0
    if (lb >= 2) {
      deterministicInsights.push({
        id: "gen_load_bank_vocab",
        title: "Load bank or commissioning language appears in recent work order titles",
        detail: "Keyword-only signal from titles in the last 90 days — verify scope on the underlying jobs.",
        severity: "low",
        evidence: [`Load-bank vocabulary hits in titles (90d): ${lb}`],
      })
    }
  }

  if (args.industryKey === "hvac_r") {
    if (metrics.workOrdersEmergency90d >= 3) {
      deterministicInsights.push({
        id: "hvac_emergency_volume",
        title: "Elevated emergency-type workload (90 days)",
        detail: "Uses the work order `type` field set to emergency — factual intake volume, not weather claims.",
        severity: metrics.workOrdersEmergency90d >= 8 ? "high" : "medium",
        evidence: [`Emergency-type work orders created (90d): ${metrics.workOrdersEmergency90d}`],
      })
    }
  }

  if (args.industryKey === "calibration_inspection") {
    if (metrics.equipmentCalibrationDueInWindow > 0) {
      deterministicInsights.push({
        id: "cal_window_due",
        title: "Calibration due dates within the next week (sampled equipment)",
        detail:
          "Counts equipment rows in the bounded sample where `next_calibration_due_at` is on or before seven days ahead — not a certificate statement.",
        severity: metrics.equipmentCalibrationDueInWindow >= 8 ? "high" : "medium",
        evidence: [`Equipment rows with calibration due in window (sample cap): ${metrics.equipmentCalibrationDueInWindow}`],
      })
    }
    const calHits = metrics.titleKeywordHits90d.calibration_vocab ?? 0
    if (calHits >= 3) {
      deterministicInsights.push({
        id: "cal_title_vocab",
        title: "Calibration vocabulary appears frequently in recent work order titles",
        detail: "Substring counts on titles in the last 90 days — use as a triage cue alongside formal calibration due fields.",
        severity: "low",
        evidence: [`Calibration vocabulary hits in titles (90d): ${calHits}`],
      })
    }
  }

  // Repeat equipment from core snapshot (already 90d window, ≥2 WOs)
  const repeat = counts.repeatEquipmentPatterns ?? []
  const heavyRepeat = repeat.filter((r) => r.workOrdersInWindow >= 3)
  if (heavyRepeat.length > 0 && deterministicInsights.length < 6) {
    deterministicInsights.push({
      id: "core_repeat_equipment",
      title: "Heavy repeat work on specific equipment (90 days)",
      detail:
        "Equipment appears three or more times on work orders in the rolling 90-day window — reliability signal from volume only.",
      severity: heavyRepeat.length >= 4 ? "high" : "medium",
      evidence: [
        `Equipment with ≥3 work orders in 90d (top slice): ${heavyRepeat.length}`,
        "Review the repeat-repair / equipment list in Work Orders filtered by asset history.",
      ],
    })
  }

  // Cap cards for UI density
  const cappedInsights = deterministicInsights.slice(0, 5)

  return {
    industryKey: args.industryKey,
    profileId: profile.profileId,
    dashboardSummaryLines,
    maintenanceSummaryLines,
    deterministicInsights: cappedInsights,
    recommendationPriors: profile.recommendationAngles,
    maintenancePriors: profile.maintenanceAngles,
  }
}
