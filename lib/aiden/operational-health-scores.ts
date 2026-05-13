import type { IndustryOperationalMetrics } from "@/lib/aiden/industry-operational-metrics"
import {
  computeOperationalHealthWeights,
  industryHealthWeightingSummary,
} from "@/lib/aiden/operational-health-industry-weights"
import type {
  OperationalHealthCategoryId,
  OperationalHealthCategoryScore,
  OperationalHealthContributingFactor,
  OperationalHealthOverallBand,
  OperationalHealthScoresReport,
} from "@/lib/aiden/operational-health-score-types"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

export type { OperationalHealthScoresReport } from "@/lib/aiden/operational-health-score-types"

export type OperationalHealthCountsInput = {
  agingActiveWorkOrdersUpdatedBefore14d: number
  scheduledDatePassedStillActive: number
  activeWorkOrdersUnassigned: number
  maintenancePlansPastDue: number
  maxJobsSameDaySameAssignee: number
  repeatEquipmentPatterns?: Array<{ equipmentId: string; workOrdersInWindow: number }>
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function roundScore(n: number): number {
  return Math.round(clamp(n, 0, 100))
}

function bandFromOverall(score: number): { band: OperationalHealthOverallBand; label: string } {
  if (score < 40) return { band: "at_risk", label: "At risk" }
  if (score < 55) return { band: "needs_attention", label: "Needs attention" }
  if (score < 70) return { band: "stable", label: "Stable" }
  if (score < 85) return { band: "strong", label: "Strong" }
  return { band: "optimized", label: "Optimized" }
}

function scorePreventiveMaintenance(pastDue: number, pm90: number): { score: number; factors: OperationalHealthContributingFactor[] } {
  const pastDuePenalty = clamp(pastDue * 6.5, 0, 85)
  let score = 100 - pastDuePenalty
  const factors: OperationalHealthContributingFactor[] = [
    {
      label: "Active PM plans past next due date",
      impact: pastDue > 0 ? "negative" : "positive",
      value: pastDue,
      detail:
        pastDue > 0 ?
          "Each past-due plan subtracts up to ~6.5 points (capped) — factual schedule debt from maintenance_plans."
        : "No past-due active plans in the snapshot query window.",
    },
  ]
  if (pm90 > 0) {
    const cadenceBonus = clamp(8 * (pm90 / (pm90 + pastDue + 6)), 0, 8)
    score += cadenceBonus
    factors.push({
      label: "PM-type work orders created (90d)",
      impact: "positive",
      value: pm90,
      detail: "Recent PM-type volume is a small positive offset — it does not prove completion quality.",
    })
  }
  return { score: roundScore(score), factors }
}

function scoreAssetReadiness(m: IndustryOperationalMetrics): { score: number | null; factors: OperationalHealthContributingFactor[] } {
  const total = m.equipmentTotal
  if (total < 3) {
    return {
      score: null,
      factors: [
        {
          label: "Equipment sample size",
          impact: "neutral",
          value: total,
          detail: "Fewer than three equipment rows in the bounded sample — readiness index is not scored to avoid false precision.",
        },
      ],
    }
  }
  const activeShare = m.equipmentActive / total
  const repairOosShare = m.equipmentInRepairOrOos / total
  const score = roundScore(clamp(100 * (0.55 * activeShare + 0.45 * (1 - repairOosShare)), 0, 100))
  return {
    score,
    factors: [
      {
        label: "Share of equipment marked active",
        impact: activeShare >= 0.55 ? "positive" : "negative",
        value: `${Math.round(activeShare * 100)}%`,
        detail: "Computed from sampled equipment status flags (not rental contract utilization).",
      },
      {
        label: "Share in repair or out of service",
        impact: repairOosShare <= 0.25 ? "positive" : "negative",
        value: `${Math.round(repairOosShare * 100)}%`,
        detail: "Uses in_repair and out_of_service statuses in the same sample.",
      },
    ],
  }
}

function scoreDispatch(
  unassigned: number,
  critHigh: number,
  emergency90: number,
  maxSameDay: number,
): { score: number; factors: OperationalHealthContributingFactor[] } {
  let s = 100
  s -= clamp(unassigned * 2.8, 0, 38)
  s -= clamp(critHigh * 2.6, 0, 36)
  s -= clamp(emergency90 * 1.6, 0, 32)
  s -= clamp(Math.max(0, maxSameDay - 3) * 2.2, 0, 18)
  return {
    score: roundScore(s),
    factors: [
      {
        label: "Active work orders without assignee",
        impact: unassigned > 0 ? "negative" : "positive",
        value: unassigned,
        detail: "Counts active statuses with null assigned_user_id and assigned_technician_id.",
      },
      {
        label: "Critical / high priority active jobs",
        impact: critHigh > 0 ? "negative" : "positive",
        value: critHigh,
        detail: "Uses priority field on non-terminal work orders.",
      },
      {
        label: "Emergency-type work orders (90d)",
        impact: emergency90 > 5 ? "negative" : "neutral",
        value: emergency90,
        detail: "Rolling 90-day created volume with type = emergency.",
      },
      {
        label: "Peak jobs same day / same assignee (next 7d window sample)",
        impact: maxSameDay > 6 ? "negative" : "neutral",
        value: maxSameDay,
        detail: "Congestion proxy from scheduled window — not proof of overtime.",
      },
    ],
  }
}

function scoreInspection(inspectionPast: number, calDueWindow: number): { score: number; factors: OperationalHealthContributingFactor[] } {
  const slipPenalty = clamp(inspectionPast * 7.5, 0, 82)
  const calPenalty = clamp(calDueWindow * 4, 0, 40)
  const score = roundScore(100 - slipPenalty - calPenalty * 0.35)
  return {
    score,
    factors: [
      {
        label: "Inspection-type jobs past scheduled date (active)",
        impact: inspectionPast > 0 ? "negative" : "positive",
        value: inspectionPast,
        detail: "Non-terminal inspection work orders with scheduled_on before today (UTC).",
      },
      {
        label: "Calibration due within 7 days (sampled equipment)",
        impact: calDueWindow > 5 ? "negative" : "neutral",
        value: calDueWindow,
        detail: "Uses next_calibration_due_at in bounded equipment sample — not a certificate assertion.",
      },
    ],
  }
}

function scoreResponsiveness(aging14d: number): { score: number; factors: OperationalHealthContributingFactor[] } {
  return {
    score: roundScore(100 - clamp(aging14d * 3.8, 0, 88)),
    factors: [
      {
        label: "Active work orders stale 14+ days",
        impact: aging14d > 0 ? "negative" : "positive",
        value: aging14d,
        detail: "Active statuses with updated_at older than fourteen days.",
      },
    ],
  }
}

function scoreBacklog(
  scheduledPast: number,
  aging: number,
  heavyRepeatEquip: number,
): { score: number; factors: OperationalHealthContributingFactor[] } {
  const stress = scheduledPast * 2.1 + aging * 1.4 + heavyRepeatEquip * 5
  return {
    score: roundScore(100 - clamp(stress * 2.2, 0, 92)),
    factors: [
      {
        label: "Active jobs past scheduled date",
        impact: scheduledPast > 0 ? "negative" : "positive",
        value: scheduledPast,
        detail: "Calendar slip on non-terminal work orders.",
      },
      {
        label: "Stale active jobs (14d+)",
        impact: aging > 0 ? "negative" : "positive",
        value: aging,
        detail: "Same aging signal as responsiveness, applied here as backlog pressure.",
      },
      {
        label: "Assets with heavy repeat volume (90d)",
        impact: heavyRepeatEquip > 0 ? "negative" : "positive",
        value: heavyRepeatEquip,
        detail: "Count of equipment ids with ≥3 work orders in the 90-day repeat slice.",
      },
    ],
  }
}

function scoreFinancial(overdue: number | null | undefined): { score: number | null; factors: OperationalHealthContributingFactor[] } {
  if (overdue === null || overdue === undefined) {
    return {
      score: null,
      factors: [
        {
          label: "Invoice aging data",
          impact: "neutral",
          value: "not included",
          detail: "Financial slice omitted (no billing permission or snapshot skipped financial hints).",
        },
      ],
    }
  }
  return {
    score: roundScore(100 - clamp(overdue * 7, 0, 90)),
    factors: [
      {
        label: "Overdue / past-due open invoices (bounded sample)",
        impact: overdue > 0 ? "negative" : "positive",
        value: overdue,
        detail: "Counts sent, unpaid, or overdue invoices with due_date before today or status overdue.",
      },
    ],
  }
}

function gapsForCategory(id: OperationalHealthCategoryId, score: number): string[] {
  if (score >= 72) return []
  switch (id) {
    case "preventive_maintenance_health":
      return ["Reconcile PM schedules against technician capacity.", "Close completed visits still showing active plans."]
    case "asset_readiness":
      return ["Review equipment stuck in repair or out of service.", "Validate status flags against yard reality."]
    case "dispatch_efficiency":
      return ["Assign owners to unassigned active jobs.", "Triage critical/high queue before adding new emergency work."]
    case "inspection_compliance":
      return ["Clear inspection jobs past scheduled date.", "Book calibrations inside the due window."]
    case "operational_responsiveness":
      return ["Touch stale active work orders — status, note, or reschedule.", "Confirm parts and customer holds explicitly."]
    case "work_order_backlog_health":
      return ["Drive down schedule slip and stale WOs jointly.", "Investigate repeat-asset volume drivers."]
    case "financial_workflow_completion":
      return ["Collect or re-bill overdue invoices.", "Resolve disputes blocking payment."]
    default:
      return []
  }
}

function recommendationForCategory(id: OperationalHealthCategoryId, score: number): string {
  if (score >= 85) return "Maintain current cadence — continue periodic spot checks."
  if (score >= 70) return "Monitor weekly; address outliers before they compound."
  if (score >= 55) return "Schedule a focused review with dispatch and maintenance leads."
  if (score >= 40) return "Prioritize remediation this week — multiple drivers are below target."
  return "Treat as a management escalation candidate — several factual stress signals are elevated."
}

const CATEGORY_TITLES: Record<OperationalHealthCategoryId, string> = {
  preventive_maintenance_health: "Preventive maintenance health",
  asset_readiness: "Asset readiness",
  dispatch_efficiency: "Dispatch efficiency",
  inspection_compliance: "Inspection & calibration compliance",
  operational_responsiveness: "Operational responsiveness",
  work_order_backlog_health: "Work order backlog health",
  financial_workflow_completion: "Financial workflow completion",
}

export function buildOperationalHealthScores(args: {
  generatedAt: string
  industryKey: WorkspaceIndustryKey | null
  /** When metrics were fetched with a fallback profile (document transparency). */
  metricsSamplingIndustryKey?: WorkspaceIndustryKey
  metrics: IndustryOperationalMetrics
  counts: OperationalHealthCountsInput
  overdueInvoiceCount?: number | null
}): OperationalHealthScoresReport {
  const { metrics, counts } = args
  const heavyRepeat =
    counts.repeatEquipmentPatterns?.filter((r) => r.workOrdersInWindow >= 3).length ?? 0

  const pm = scorePreventiveMaintenance(counts.maintenancePlansPastDue, metrics.workOrdersPmType90d)
  const asset = scoreAssetReadiness(metrics)
  const dispatch = scoreDispatch(
    counts.activeWorkOrdersUnassigned,
    metrics.workOrdersCriticalOrHighOpen,
    metrics.workOrdersEmergency90d,
    counts.maxJobsSameDaySameAssignee,
  )
  const inspection = scoreInspection(
    metrics.workOrdersInspectionActiveScheduledPast,
    metrics.equipmentCalibrationDueInWindow,
  )
  const responsiveness = scoreResponsiveness(counts.agingActiveWorkOrdersUpdatedBefore14d)
  const backlog = scoreBacklog(
    counts.scheduledDatePassedStillActive,
    counts.agingActiveWorkOrdersUpdatedBefore14d,
    heavyRepeat,
  )
  const fin = scoreFinancial(args.overdueInvoiceCount)

  const categoryBuilders: Array<{
    id: OperationalHealthCategoryId
    score: number | null
    factors: OperationalHealthContributingFactor[]
  }> = [
    { id: "preventive_maintenance_health", score: pm.score, factors: pm.factors },
    { id: "asset_readiness", score: asset.score, factors: asset.factors },
    { id: "dispatch_efficiency", score: dispatch.score, factors: dispatch.factors },
    { id: "inspection_compliance", score: inspection.score, factors: inspection.factors },
    { id: "operational_responsiveness", score: responsiveness.score, factors: responsiveness.factors },
    { id: "work_order_backlog_health", score: backlog.score, factors: backlog.factors },
    { id: "financial_workflow_completion", score: fin.score, factors: fin.factors },
  ]

  const included = categoryBuilders.filter((c) => c.score !== null).map((c) => c.id)
  const weightsUsed = computeOperationalHealthWeights(args.industryKey, included)
  const weightingBlurb = industryHealthWeightingSummary(args.industryKey)

  let overall = 0
  for (const c of categoryBuilders) {
    if (c.score === null) continue
    overall += weightsUsed[c.id] * c.score
  }
  overall = roundScore(overall)
  const { band, label } = bandFromOverall(overall)

  const categories: OperationalHealthCategoryScore[] = categoryBuilders.map((c) => {
    const s = c.score ?? 0
    const includedIn = c.score !== null
    return {
      id: c.id,
      title: CATEGORY_TITLES[c.id],
      score: includedIn ? s : 0,
      scoreIncludedInOverall: includedIn,
      contributingFactors: c.factors,
      weightedLogicNote: includedIn ?
        `${weightingBlurb} This category carried ${(weightsUsed[c.id] * 100).toFixed(1)}% of the overall rollup.`
      : `${weightingBlurb} This category was excluded from the rollup due to insufficient or withheld inputs.`,
      recommendation: includedIn ? recommendationForCategory(c.id, s) : "Not scored — set industry or permissions to include this slice.",
      operationalGaps: includedIn ? gapsForCategory(c.id, s) : ["Add missing operational inputs (see contributing factors)."],
    }
  })

  const methodologyNote =
    "Scores are deterministic indices (0–100) from Equipify tables in this snapshot. They summarize workload shape; they are not predictions, diagnoses, autonomous recommendations, or guaranteed business outcomes."

  const limitations = [
    "Bounded samples and org scope (e.g., technician-assigned-only) can change counts versus full-company totals.",
    "Title-keyword metrics in industry profiles are heuristic text scans — they never imply sensor certainty.",
    "Asset readiness uses register status fields only — not telematics or contract utilization.",
  ]

  const overallSummary = `Overall ${overall}/100 (${label}) — weighted across ${included.length} scored categories using the ${args.industryKey ? "workspace" : "generic"} industry template.`

  return {
    generatedAt: args.generatedAt,
    industryKey: args.industryKey,
    metricsSamplingIndustryKey:
      args.metricsSamplingIndustryKey && args.metricsSamplingIndustryKey !== args.industryKey ?
        args.metricsSamplingIndustryKey
      : undefined,
    overallScore: overall,
    overallBand: band,
    overallLabel: label,
    overallSummary,
    categories,
    weightsUsed,
    methodologyNote,
    limitations,
  }
}
