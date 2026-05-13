import "server-only"

import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"
import type { IndustryOperationalBrief } from "@/lib/aiden/industry-operational-public-types"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import { getIndustryOperationalProfile } from "@/lib/aiden/industry-operational-profiles"
import type { IndustryOperationalMetrics, CountsSlice } from "@/lib/aiden/industry-operational-metrics"
import {
  compareDashboardFindings,
  compareOperationalInsights,
  createDashboardFinding,
  createOperationalInsight,
  INSIGHT_SEVERITY_RANK,
} from "@/lib/aiden/operational-insight-schema"
import type {
  DeterministicOperationalInsight,
  OperationalDashboardFinding,
  OperationalInsightSeverity,
} from "@/lib/aiden/operational-insight-schema"

function workloadAgingSeverity(n: number): OperationalInsightSeverity {
  if (n >= 15) return "critical"
  if (n >= 6) return "high"
  if (n >= 1) return "medium"
  return "low"
}

function scheduleSlipSeverity(n: number): OperationalInsightSeverity {
  if (n >= 18) return "critical"
  if (n >= 8) return "high"
  if (n >= 1) return "medium"
  return "low"
}

function pmPastDueSeverity(n: number): OperationalInsightSeverity {
  if (n >= 15) return "critical"
  if (n >= 8) return "high"
  if (n >= 3) return "medium"
  return "low"
}

function baseAgingSignal(counts: CountsSlice): number {
  return counts.scheduledDatePassedStillActive + counts.agingActiveWorkOrdersUpdatedBefore14d
}

function severityNeedsAttention(sev: OperationalInsightSeverity): boolean {
  return INSIGHT_SEVERITY_RANK[sev] >= INSIGHT_SEVERITY_RANK.medium
}

export function buildIndustryOperationalBrief(args: {
  industryKey: WorkspaceIndustryKey
  moduleContext: OperationalModuleContext
  metrics: IndustryOperationalMetrics
  counts: CountsSlice
}): IndustryOperationalBrief {
  const profile = getIndustryOperationalProfile(args.industryKey)
  const { metrics, counts } = args
  const agingSig = baseAgingSignal(counts)

  const dashboardOperationalSummaries: OperationalDashboardFinding[] = []
  const maintenanceOperationalSummaries: OperationalDashboardFinding[] = []

  const pushUniqueFinding = (arr: OperationalDashboardFinding[], f: OperationalDashboardFinding) => {
    if (!arr.some((x) => x.id === f.id)) arr.push(f)
  }

  if (counts.maintenancePlansPastDue > 0) {
    const n = counts.maintenancePlansPastDue
    const sev = pmPastDueSeverity(n)
    const dash = createDashboardFinding({
      id: "dash_pm_plans_past_due",
      title: "Past-due PM plans",
      detail:
        "Active maintenance plans whose next due date is before today are schedule debt — they affect technician routing and contract coverage.",
      triggerRationale: `At least one active maintenance plan row has next_due before today; current count is ${n}.`,
      thresholdsUsed: [
        "PM lateness severity: 1–2 plans → low; 3–7 → medium; 8–14 → high; ≥15 → critical (count-based only).",
      ],
      severity: sev,
      confidence: "strong-signal",
      category: "pm-adoption",
      recommendationType: "review",
      actionability: "manual",
      supportingMetrics: [
        { key: "maintenance_plans_past_due", label: "Active plans past next due", value: n, source: "maintenance_plans" },
      ],
      suggestedNextStep: "Review overdue PM plans and reschedule or close completed visits.",
      relevantModule: "maintenance_plans",
      suggestedWorkflow: "Open Maintenance Plans → sort by next due → assign or batch reschedule with dispatch.",
      agingSignal: agingSig + n * 2,
      scheduledPastActive: counts.scheduledDatePassedStillActive,
      pastDuePm: n,
      text: `${n} active maintenance plan(s) have a next due date in the past — review PM coverage vs technician capacity.`,
    })
    pushUniqueFinding(dashboardOperationalSummaries, dash)

    const maint = createDashboardFinding({
      id: "maint_pm_plans_past_due",
      title: "Past-due PM plans (maintenance lens)",
      detail: dash.detail,
      triggerRationale: dash.triggerRationale,
      thresholdsUsed: dash.thresholdsUsed,
      severity: dash.severity,
      confidence: dash.confidence,
      category: dash.category,
      recommendationType: "reconcile",
      actionability: dash.actionability,
      supportingMetrics: dash.supportingMetrics,
      suggestedNextStep: "Reconcile PM backlog against technician capacity before selling new coverage.",
      relevantModule: "maintenance_plans",
      suggestedWorkflow: dash.suggestedWorkflow,
      agingSignal: dash.agingSignal,
      scheduledPastActive: counts.scheduledDatePassedStillActive,
      pastDuePm: n,
      text: `Past-due PM plans: ${n}. Reconcile schedules before adding new agreements.`,
    })
    pushUniqueFinding(maintenanceOperationalSummaries, maint)
  }

  if (counts.agingActiveWorkOrdersUpdatedBefore14d > 0) {
    const n = counts.agingActiveWorkOrdersUpdatedBefore14d
    const sev = workloadAgingSeverity(n)
    const f = createDashboardFinding({
      id: "dash_work_orders_stale_14d",
      title: "Aging active work orders",
      detail:
        "Work orders still in an active status but not updated in 14+ days often indicate stalled dispatch, parts holds, or missing customer contact.",
      triggerRationale: `Active work orders with last update older than 14 days: ${n}.`,
      thresholdsUsed: [
        "Workload aging severity: 1–5 active WOs → medium; 6–14 → high; ≥15 → critical.",
        "Stale definition: status in open/scheduled/in_progress (per snapshot query) and updated_at < today-14d.",
      ],
      severity: sev,
      confidence: "strong-signal",
      category: "operational-efficiency",
      recommendationType: "investigate",
      actionability: "manual",
      supportingMetrics: [
        { key: "active_wo_stale_14d", label: "Active WOs stale 14+ days", value: n, source: "work_orders" },
      ],
      suggestedNextStep: "Triage stalled jobs: confirm status, assign owner, or reschedule.",
      relevantModule: "work_orders",
      suggestedWorkflow: "Work Orders → filter active → sort by last updated → call assignees or customers.",
      agingSignal: agingSig + n,
      scheduledPastActive: counts.scheduledDatePassedStillActive,
      pastDuePm: counts.maintenancePlansPastDue,
      text: `${n} active work order(s) have not been updated in 14+ days — triage stalled jobs.`,
    })
    pushUniqueFinding(dashboardOperationalSummaries, f)
  }

  if (counts.scheduledDatePassedStillActive > 0) {
    const n = counts.scheduledDatePassedStillActive
    const sev = scheduleSlipSeverity(n)
    const f = createDashboardFinding({
      id: "dash_schedule_date_passed_active",
      title: "Schedule slip on active jobs",
      detail:
        "Active work orders whose scheduled_on is before today are backlog on the calendar — they drive customer SLA risk and technician rework.",
      triggerRationale: `Non-terminal work orders with scheduled_on < today (UTC date): ${n}.`,
      thresholdsUsed: [
        "Schedule slip severity: 1–7 → medium; 8–17 → high; ≥18 → critical.",
        "Counts only rows in active statuses with a non-null scheduled_on.",
      ],
      severity: sev,
      confidence: "strong-signal",
      category: "dispatch-risk",
      recommendationType: "reconcile",
      actionability: "assisted",
      supportingMetrics: [
        { key: "active_wo_scheduled_past", label: "Active WOs past scheduled date", value: n, source: "work_orders" },
      ],
      suggestedNextStep: "Reschedule or close out jobs that are past their scheduled date.",
      relevantModule: "work_orders",
      suggestedWorkflow: "Service schedule or Work Orders → overdue by scheduled date → bulk reschedule.",
      agingSignal: agingSig + n * 2,
      scheduledPastActive: n,
      pastDuePm: counts.maintenancePlansPastDue,
      text: `${n} active work order(s) have a scheduled date in the past — reschedule or close out.`,
    })
    pushUniqueFinding(dashboardOperationalSummaries, f)
  }

  if (metrics.workOrdersCriticalOrHighOpen > 0) {
    const n = metrics.workOrdersCriticalOrHighOpen
    const sev: OperationalInsightSeverity = n >= 12 ? "critical" : n >= 5 ? "high" : "medium"
    const f = createDashboardFinding({
      id: "dash_critical_high_open",
      title: "Critical / high priority work in flight",
      detail:
        "Open, scheduled, or in-progress jobs marked critical or high priority consume supervisory attention and can block SLAs.",
      triggerRationale: `Count of active work orders with priority critical or high: ${n}.`,
      thresholdsUsed: ["Severity: ≥5 → high; ≥12 → critical; otherwise medium when count ≥1."],
      severity: sev,
      confidence: "strong-signal",
      category: "dispatch-risk",
      recommendationType: "review",
      actionability: "manual",
      supportingMetrics: [
        { key: "wo_critical_high_open", label: "Critical/high active WOs", value: n, source: "work_orders" },
      ],
      suggestedNextStep: "Review the critical/high queue and confirm owners, parts, and customer comms.",
      relevantModule: "work_orders",
      suggestedWorkflow: "Work Orders → priority filter critical/high → oldest scheduled first.",
      agingSignal: agingSig + n,
      scheduledPastActive: counts.scheduledDatePassedStillActive,
      pastDuePm: counts.maintenancePlansPastDue,
      text: `${n} active work order(s) are marked critical or high priority — confirm dispatch coverage.`,
    })
    pushUniqueFinding(dashboardOperationalSummaries, f)
  }

  if (metrics.workOrdersEmergency90d >= 6) {
    const n = metrics.workOrdersEmergency90d
    const sev: OperationalInsightSeverity = n >= 18 ? "critical" : n >= 10 ? "high" : "medium"
    const f = createDashboardFinding({
      id: "dash_emergency_volume_90d",
      title: "Elevated emergency work order intake (90 days)",
      detail:
        "Emergency-type work orders created in the rolling 90-day window measure reactive load — compare to PM and inspection volume for cadence health.",
      triggerRationale: `Emergency-type WOs created in last 90d: ${n} (type field = emergency).`,
      thresholdsUsed: ["Dashboard flag when emergency WOs (90d) ≥6; severity steps at 10 and 18."],
      severity: sev,
      confidence: "strong-signal",
      category: "dispatch-risk",
      recommendationType: "investigate",
      actionability: "manual",
      supportingMetrics: [
        { key: "wo_emergency_90d", label: "Emergency-type WOs (90d)", value: n, source: "work_orders" },
      ],
      suggestedNextStep: "Segment emergency causes (asset class, customer, technician) and rebalance PM windows.",
      relevantModule: "work_orders",
      suggestedWorkflow: "Work Orders → type=emergency → group by equipment/customer for repeat drivers.",
      agingSignal: agingSig,
      scheduledPastActive: counts.scheduledDatePassedStillActive,
      pastDuePm: counts.maintenancePlansPastDue,
      text: `${n} emergency-type work orders were created in the last 90 days — review reactive vs planned workload.`,
    })
    pushUniqueFinding(dashboardOperationalSummaries, f)
  }

  const deterministicInsights: DeterministicOperationalInsight[] = []

  if (args.industryKey === "refrigeration_service") {
    if (metrics.emergencyRepeatEquipmentCount >= 1) {
      const erc = metrics.emergencyRepeatEquipmentCount
      const sev: OperationalInsightSeverity =
        erc >= 6 ? "critical" : erc >= 3 ? "high" : "medium"
      deterministicInsights.push(
        createOperationalInsight({
          id: "ref_repeat_emergency_equipment",
          title: "Repeat emergency work on the same equipment",
          detail:
            "Multiple emergency-type work orders in the last 90 days reference the same equipment id at least twice. Review asset history before declaring the rack or case stable.",
          triggerRationale:
            "Equipment-level emergency counts in 90d: any equipment_id with ≥2 emergency WOs increments this counter.",
          thresholdsUsed: [
            "Insight fires when ≥1 equipment has ≥2 emergency WOs in 90d.",
            "Card severity scales with count of such equipment (≥3 high, ≥6 critical).",
          ],
          severity: sev,
          confidence: erc >= 3 ? "confirmed-pattern" : "strong-signal",
          category: "maintenance-risk",
          recommendationType: "investigate",
          actionability: "manual",
          supportingMetrics: [
            { key: "equip_repeat_emergency_90d", label: "Equipment with ≥2 emergency WOs (90d)", value: erc, source: "work_orders" },
            { key: "wo_emergency_90d", label: "Emergency-type WOs (90d)", value: metrics.workOrdersEmergency90d, source: "work_orders" },
          ],
          suggestedNextStep: "Investigate repeat refrigeration failures on flagged assets before closing the loop.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Work Orders → filter emergency → sort by equipment → open asset history.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    const leakHits = metrics.titleKeywordHits90d.refrigerant_leak_vocab ?? 0
    if (leakHits >= 2) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "ref_title_leak_vocab",
          title: "Work order titles mention refrigerant or leak language",
          detail:
            "Counts are from substring matches on work order titles in the last 90 days — not a confirmed leak diagnosis.",
          triggerRationale: `Industry title keyword bundle “refrigerant_leak_vocab” matched ${leakHits} title(s) in 90d sample.`,
          thresholdsUsed: ["Fire when ≥2 title hits in 90d; severity high when ≥6 hits.", "Source: bounded title scan (≤600 recent rows)."],
          severity: leakHits >= 6 ? "high" : "medium",
          confidence: "heuristic",
          category: "maintenance-risk",
          recommendationType: "monitor",
          actionability: "manual",
          supportingMetrics: [{ key: "title_leak_vocab_90d", label: "Leak vocabulary hits in titles (90d)", value: leakHits, source: "title_scan" }],
          suggestedNextStep: "Spot-check recent jobs with leak language and verify leak checks on site.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Search titles for leak vocabulary → open WO → confirm technician notes.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    if (
      (args.moduleContext === "maintenance_plans" || args.moduleContext === "dashboard") &&
      counts.maintenancePlansPastDue > 0
    ) {
      const p = counts.maintenancePlansPastDue
      deterministicInsights.push(
        createOperationalInsight({
          id: "ref_pm_past_due",
          title: "Refrigeration PM plans are past due",
          detail:
            "Past-due PM plan rows are factual schedule debt — align compressor/rack PM visits with the dates already stored on plans.",
          triggerRationale: `Past-due active maintenance plans: ${p}.`,
          thresholdsUsed: ["Shown when count ≥1 in maintenance or dashboard context.", "Uses same PM lateness count as dashboard summaries."],
          severity: p >= 8 ? "high" : p >= 3 ? "medium" : "low",
          confidence: "strong-signal",
          category: "pm-adoption",
          recommendationType: "schedule",
          actionability: "assisted",
          supportingMetrics: [{ key: "maintenance_plans_past_due", label: "Active plans past next due", value: p, source: "maintenance_plans" }],
          suggestedNextStep: "Review overdue PM plans and compress routes for rack/case PMs.",
          relevantModule: "maintenance_plans",
          suggestedWorkflow: "Maintenance Plans → overdue → assign tech bands by geography.",
          agingSignal: agingSig + p * 2,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: p,
        }),
      )
    }
  }

  if (args.industryKey === "equipment_rental") {
    if (metrics.equipmentTotal >= 4) {
      const readiness = metrics.equipmentTotal > 0 ? metrics.equipmentActive / metrics.equipmentTotal : 1
      if (readiness < 0.55) {
        deterministicInsights.push(
          createOperationalInsight({
            id: "rental_readiness_mix",
            title: "Low share of equipment marked active",
            detail:
              "Readiness is approximated from equipment status flags in the register (active vs in_repair/out_of_service) — not a rental contract metric.",
            triggerRationale: `Active share = active / sampled equipment = ${readiness.toFixed(2)} (requires ≥4 equipment rows).`,
            thresholdsUsed: ["Fire when active share <0.55 with sample size ≥4.", "High severity when share <0.35."],
            severity: readiness < 0.35 ? "high" : "medium",
            confidence: "strong-signal",
            category: "asset-readiness",
            recommendationType: "review",
            actionability: "manual",
            supportingMetrics: [
              { key: "equipment_sample_total", label: "Equipment rows sampled", value: metrics.equipmentTotal, source: "equipment" },
              { key: "equipment_active", label: "Status active", value: metrics.equipmentActive, source: "equipment" },
              { key: "equipment_in_repair_oos", label: "In repair or out of service", value: metrics.equipmentInRepairOrOos, source: "equipment" },
            ],
            suggestedNextStep: "Inspect rental turnaround assets stuck in repair or OOS.",
            relevantModule: "equipment",
            suggestedWorkflow: "Equipment → filter in_repair/out_of_service → confirm turnaround targets.",
            agingSignal: agingSig,
            scheduledPastActive: counts.scheduledDatePassedStillActive,
            pastDuePm: counts.maintenancePlansPastDue,
          }),
        )
      }
    }
    if (metrics.workOrdersInspectionActiveScheduledPast > 0) {
      const n = metrics.workOrdersInspectionActiveScheduledPast
      deterministicInsights.push(
        createOperationalInsight({
          id: "rental_inspection_past_due",
          title: "Inspection jobs past scheduled date still active",
          detail:
            "Counts inspection-type work orders that remain non-terminal while scheduled_on is before today — common turnaround choke point.",
          triggerRationale: `Inspection-type active WOs with scheduled_on < today: ${n}.`,
          thresholdsUsed: ["Severity high when count ≥4; else medium for any ≥1."],
          severity: n >= 4 ? "high" : "medium",
          confidence: "strong-signal",
          category: "inspection-compliance",
          recommendationType: "schedule",
          actionability: "assisted",
          supportingMetrics: [{ key: "inspection_active_scheduled_past", label: "Inspection WOs past scheduled date", value: n, source: "work_orders" }],
          suggestedNextStep: "Clear inspection backlog affecting rental turnaround.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Work Orders → type inspection → scheduled date ascending → complete or reschedule.",
          agingSignal: agingSig + n,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
  }

  if (args.industryKey === "material_handling") {
    if (metrics.workOrdersInspectionActiveScheduledPast > 0) {
      const n = metrics.workOrdersInspectionActiveScheduledPast
      deterministicInsights.push(
        createOperationalInsight({
          id: "mh_inspection_backlog",
          title: "Inspection work is behind scheduled dates",
          detail:
            "Non-terminal inspection jobs with a scheduled date in the past indicate a compliance or yard queue risk for industrial trucks.",
          triggerRationale: `Inspection-type active WOs past scheduled date: ${n}.`,
          thresholdsUsed: ["Severity high when count ≥3."],
          severity: n >= 3 ? "high" : "medium",
          confidence: "strong-signal",
          category: "inspection-compliance",
          recommendationType: "schedule",
          actionability: "assisted",
          supportingMetrics: [{ key: "inspection_active_scheduled_past", label: "Inspection WOs past scheduled date", value: n, source: "work_orders" }],
          suggestedNextStep: "Prioritize inspection routes for trucks past scheduled inspection dates.",
          relevantModule: "service_schedule",
          suggestedWorkflow: "Service schedule → inspection jobs → assign yard blocks.",
          agingSignal: agingSig + n,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    const forkHits = metrics.titleKeywordHits90d.forklift_vocab ?? 0
    if (forkHits >= 1 && metrics.workOrdersInspectionType90d < metrics.workOrdersPmType90d) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "mh_forklift_vocab_vs_pm",
          title: "Forklift wording in titles with relatively fewer inspection jobs logged",
          detail:
            "Compares 90d title keyword hits for forklift vocabulary against inspection-type vs PM-type work order counts — directional only.",
          triggerRationale:
            "Forklift vocabulary in titles suggests industrial-truck work while inspection-type 90d count is lower than PM-type count.",
          thresholdsUsed: ["Requires ≥1 forklift vocab hit AND inspection_90d < pm_90d."],
          severity: "low",
          confidence: "heuristic",
          category: "pm-adoption",
          recommendationType: "monitor",
          actionability: "manual",
          supportingMetrics: [
            { key: "title_forklift_vocab_90d", label: "Forklift vocabulary hits (90d)", value: forkHits, source: "title_scan" },
            { key: "wo_inspection_type_90d", label: "Inspection-type WOs (90d)", value: metrics.workOrdersInspectionType90d, source: "work_orders" },
            { key: "wo_pm_type_90d", label: "PM-type WOs (90d)", value: metrics.workOrdersPmType90d, source: "work_orders" },
          ],
          suggestedNextStep: "Validate inspection cadence vs PM volume for forklift fleets.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Compare inspection vs PM lists for same customers over 90d.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    if (metrics.equipmentBatteryNameOrCategoryHits >= 1 && counts.maintenancePlansPastDue > 0) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "mh_battery_pm_pressure",
          title: "Battery-named assets present while PM plans are late",
          detail:
            "Battery mentions come from equipment name/category text in the sampled register — pair with past-due PM counts as a planning cue.",
          triggerRationale: "Battery keyword present in equipment sample while PM plans are past due.",
          thresholdsUsed: ["Requires ≥1 battery hit in sampled equipment AND past-due PM count ≥1."],
          severity: "medium",
          confidence: "strong-signal",
          category: "maintenance-risk",
          recommendationType: "review",
          actionability: "manual",
          supportingMetrics: [
            { key: "equipment_battery_hits", label: "Equipment rows mentioning battery", value: metrics.equipmentBatteryNameOrCategoryHits, source: "equipment" },
            { key: "maintenance_plans_past_due", label: "Active plans past next due", value: counts.maintenancePlansPastDue, source: "maintenance_plans" },
          ],
          suggestedNextStep: "Align battery PM routes with overdue plan dates.",
          relevantModule: "maintenance_plans",
          suggestedWorkflow: "Equipment search “battery” → cross-check linked PM plans.",
          agingSignal: agingSig + counts.maintenancePlansPastDue * 2,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
  }

  if (args.industryKey === "generator_power") {
    const atsHits = metrics.titleKeywordHits90d.ats_vocab ?? 0
    const exerciseHits = metrics.titleKeywordHits90d.exercise_vocab ?? 0
    const insp = metrics.workOrdersInspectionActiveScheduledPast
    if (insp > 0 && (atsHits >= 1 || exerciseHits >= 1)) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "gen_inspection_plus_vocab",
          title: "Inspection backlog with ATS or exercise wording in recent titles",
          detail:
            "Vocabulary hits are title substring matches only. Inspection date slippage is factual from scheduled vs status fields.",
          triggerRationale: `Inspection backlog ${insp} with ATS/exercise vocabulary in 90d titles.`,
          thresholdsUsed: ["Inspection past scheduled ≥1 AND (ATS hits ≥1 OR exercise hits ≥1).", "High severity when inspection backlog ≥3."],
          severity: insp >= 3 ? "high" : "medium",
          confidence: "strong-signal",
          category: "inspection-compliance",
          recommendationType: "investigate",
          actionability: "manual",
          supportingMetrics: [
            { key: "inspection_active_scheduled_past", label: "Inspection WOs past scheduled date", value: insp, source: "work_orders" },
            { key: "title_ats_vocab_90d", label: "ATS vocabulary hits (90d)", value: atsHits, source: "title_scan" },
            { key: "title_exercise_vocab_90d", label: "Exercise vocabulary hits (90d)", value: exerciseHits, source: "title_scan" },
          ],
          suggestedNextStep: "Close inspection gaps on units showing ATS/exercise work in titles.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Filter inspection WOs past date → read titles for ATS/exercise scope.",
          agingSignal: agingSig + insp,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    } else if (insp >= 3) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "gen_inspection_backlog_only",
          title: "Multiple inspection jobs are behind their scheduled dates",
          detail: "Uses inspection-type work orders with scheduled dates in the past that are still active.",
          triggerRationale: `Inspection-type active WOs past scheduled date: ${insp}.`,
          thresholdsUsed: ["Fires when count ≥3 without additional title vocabulary gate."],
          severity: "high",
          confidence: "strong-signal",
          category: "inspection-compliance",
          recommendationType: "schedule",
          actionability: "assisted",
          supportingMetrics: [{ key: "inspection_active_scheduled_past", label: "Inspection WOs past scheduled date", value: insp, source: "work_orders" }],
          suggestedNextStep: "Expedite generator inspection routes with largest schedule slip.",
          relevantModule: "service_schedule",
          suggestedWorkflow: "Service schedule → inspection → sort by slipped days.",
          agingSignal: agingSig + insp,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    const lb = metrics.titleKeywordHits90d.load_bank_vocab ?? 0
    if (lb >= 2) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "gen_load_bank_vocab",
          title: "Load bank or commissioning language appears in recent work order titles",
          detail: "Keyword-only signal from titles in the last 90 days — verify scope on the underlying jobs.",
          triggerRationale: `Load-bank vocabulary hits in titles: ${lb}.`,
          thresholdsUsed: ["Fire when ≥2 hits in 90d title sample."],
          severity: "low",
          confidence: "heuristic",
          category: "operational-efficiency",
          recommendationType: "monitor",
          actionability: "manual",
          supportingMetrics: [{ key: "title_load_bank_vocab_90d", label: "Load-bank vocabulary hits (90d)", value: lb, source: "title_scan" }],
          suggestedNextStep: "Verify commissioning documentation for recent load-bank jobs.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Search titles for load bank → confirm photos and sign-off.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
  }

  if (args.industryKey === "hvac_r") {
    if (metrics.workOrdersEmergency90d >= 3) {
      const n = metrics.workOrdersEmergency90d
      deterministicInsights.push(
        createOperationalInsight({
          id: "hvac_emergency_volume",
          title: "Elevated emergency-type workload (90 days)",
          detail: "Uses the work order type field set to emergency — factual intake volume, not weather claims.",
          triggerRationale: `Emergency-type WOs created in last 90d: ${n}.`,
          thresholdsUsed: ["Industry card when emergency WOs (90d) ≥3; high when ≥8."],
          severity: n >= 8 ? "high" : "medium",
          confidence: "strong-signal",
          category: "dispatch-risk",
          recommendationType: "investigate",
          actionability: "manual",
          supportingMetrics: [{ key: "wo_emergency_90d", label: "Emergency-type WOs (90d)", value: n, source: "work_orders" }],
          suggestedNextStep: "Analyze emergency dispatch mix vs PM completion for HVAC-R accounts.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Emergency WOs by customer → tie to PM plan adherence.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
  }

  if (args.industryKey === "calibration_inspection") {
    if (metrics.equipmentCalibrationDueInWindow > 0) {
      const n = metrics.equipmentCalibrationDueInWindow
      deterministicInsights.push(
        createOperationalInsight({
          id: "cal_window_due",
          title: "Calibration due dates within the next week (sampled equipment)",
          detail:
            "Counts equipment rows in the bounded sample where next_calibration_due_at is on or before seven days ahead — not a certificate statement.",
          triggerRationale: `Equipment rows with calibration due within 7d window: ${n}.`,
          thresholdsUsed: ["Fire when count ≥1 in bounded equipment sample.", "High when ≥8 rows in window."],
          severity: n >= 8 ? "high" : "medium",
          confidence: "strong-signal",
          category: "inspection-compliance",
          recommendationType: "schedule",
          actionability: "assisted",
          supportingMetrics: [{ key: "equipment_calibration_due_window", label: "Calibration due ≤7d (sample)", value: n, source: "equipment" }],
          suggestedNextStep: "Schedule calibrations due this week before certificates lapse.",
          relevantModule: "equipment",
          suggestedWorkflow: "Equipment → calibration due sort → batch vendor dispatch.",
          agingSignal: agingSig + n,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
    const calHits = metrics.titleKeywordHits90d.calibration_vocab ?? 0
    if (calHits >= 3) {
      deterministicInsights.push(
        createOperationalInsight({
          id: "cal_title_vocab",
          title: "Calibration vocabulary appears frequently in recent work order titles",
          detail: "Substring counts on titles in the last 90 days — use as a triage cue alongside formal calibration due fields.",
          triggerRationale: `Calibration vocabulary hits in 90d titles: ${calHits}.`,
          thresholdsUsed: ["Fire when ≥3 hits in title scan."],
          severity: "low",
          confidence: "heuristic",
          category: "inspection-compliance",
          recommendationType: "monitor",
          actionability: "manual",
          supportingMetrics: [{ key: "title_calibration_vocab_90d", label: "Calibration vocabulary hits (90d)", value: calHits, source: "title_scan" }],
          suggestedNextStep: "Cross-check title-heavy calibration jobs against equipment due list.",
          relevantModule: "work_orders",
          suggestedWorkflow: "Title search calibration → verify asset linkage.",
          agingSignal: agingSig,
          scheduledPastActive: counts.scheduledDatePassedStillActive,
          pastDuePm: counts.maintenancePlansPastDue,
        }),
      )
    }
  }

  const repeat = counts.repeatEquipmentPatterns ?? []
  const heavyRepeat = repeat.filter((r) => r.workOrdersInWindow >= 3)
  if (heavyRepeat.length > 0) {
    const h = heavyRepeat.length
    deterministicInsights.push(
      createOperationalInsight({
        id: "core_repeat_equipment",
        title: "Heavy repeat work on specific equipment (90 days)",
        detail:
          "Equipment appears three or more times on work orders in the rolling 90-day window — reliability signal from volume only.",
        triggerRationale: `Distinct equipment ids with ≥3 WOs in 90d (top slice): ${h}.`,
        thresholdsUsed: ["Uses snapshot repeatEquipmentPatterns (90d window, capped list).", "Severity high when ≥4 such assets."],
        severity: h >= 4 ? "high" : "medium",
        confidence: "confirmed-pattern",
        category: "maintenance-risk",
        recommendationType: "investigate",
        actionability: "manual",
        supportingMetrics: [{ key: "heavy_repeat_equipment_count", label: "Equipment with ≥3 WOs (90d)", value: h, source: "snapshot_counts" }],
        suggestedNextStep: "Review repeat-repair list and consider root-cause review per asset.",
        relevantModule: "work_orders",
        suggestedWorkflow: "Work Orders → filter by equipment id from repeat list → read last 3 visits.",
        agingSignal: agingSig + h * 3,
        scheduledPastActive: counts.scheduledDatePassedStillActive,
        pastDuePm: counts.maintenancePlansPastDue,
      }),
    )
  }

  dashboardOperationalSummaries.sort(compareDashboardFindings)
  maintenanceOperationalSummaries.sort(compareDashboardFindings)
  const sortedInsights = [...deterministicInsights].sort(compareOperationalInsights)
  const cappedInsights = sortedInsights.slice(0, 5)

  const dashboardSummaryLines = dashboardOperationalSummaries.map((f) => f.text)
  const maintenanceSummaryLines = maintenanceOperationalSummaries.map((f) => f.text)

  const anyMediumPlus = (items: Array<{ severity: OperationalInsightSeverity }>) =>
    items.some((x) => severityNeedsAttention(x.severity))

  const signalsPresentationHealthy =
    !anyMediumPlus(dashboardOperationalSummaries) &&
    !anyMediumPlus(maintenanceOperationalSummaries) &&
    !anyMediumPlus(cappedInsights)

  return {
    industryKey: args.industryKey,
    profileId: profile.profileId,
    dashboardOperationalSummaries: dashboardOperationalSummaries.slice(0, 8),
    maintenanceOperationalSummaries: maintenanceOperationalSummaries.slice(0, 8),
    dashboardSummaryLines,
    maintenanceSummaryLines,
    deterministicInsights: cappedInsights,
    signalsPresentationHealthy,
    recommendationPriors: profile.recommendationAngles,
    maintenancePriors: profile.maintenanceAngles,
  }
}
