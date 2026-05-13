/**
 * Deterministic operational insight metadata for AIden industry/workspace signals.
 * Safe to import from client or server — no DB access.
 */
import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"

export const OPERATIONAL_MODULE_PATHS: Record<OperationalModuleContext, string> = {
  dashboard: "/",
  work_orders: "/work-orders",
  service_schedule: "/service-schedule",
  equipment: "/equipment",
  customers: "/customers",
  maintenance_plans: "/maintenance-plans",
}

export type OperationalInsightSeverity = "low" | "medium" | "high" | "critical"

export type OperationalInsightConfidence = "heuristic" | "strong-signal" | "confirmed-pattern"

export type OperationalInsightCategory =
  | "maintenance-risk"
  | "dispatch-risk"
  | "asset-readiness"
  | "inspection-compliance"
  | "pm-adoption"
  | "operational-efficiency"
  | "financial-operations"

export type OperationalInsightUrgency = "routine" | "soon" | "immediate"

export type OperationalRecommendationType = "review" | "investigate" | "schedule" | "reconcile" | "monitor"

export type OperationalInsightActionability = "manual" | "assisted" | "automated-ready"

export type SupportingMetricSource =
  | "work_orders"
  | "maintenance_plans"
  | "equipment"
  | "snapshot_counts"
  | "title_scan"
  | "composite"

export type SupportingMetric = {
  /** Stable key for APIs / notifications (e.g. `pm_plans_past_due`). */
  key: string
  /** Short human label. */
  label: string
  value: number | string
  source: SupportingMetricSource
}

/** Full deterministic insight card (industry + core snapshot heuristics). */
export type DeterministicOperationalInsight = {
  id: string
  title: string
  detail: string
  /** Why this insight exists (plain language, references thresholds). */
  triggerRationale: string
  /** Explicit threshold strings (e.g. "≥2 emergency WOs per equipment in 90d"). */
  thresholdsUsed: string[]
  severity: OperationalInsightSeverity
  confidence: OperationalInsightConfidence
  category: OperationalInsightCategory
  urgency: OperationalInsightUrgency
  recommendationType: OperationalRecommendationType
  actionability: OperationalInsightActionability
  supportingMetrics: SupportingMetric[]
  suggestedNextStep: string
  relevantModule: OperationalModuleContext
  /** One-line workflow hint for humans (future workflow engine can map this). */
  suggestedWorkflow: string
  /** Deterministic sort: higher = more operational impact. */
  impactScore: number
  /** Sort tie-breaker: stale scheduling / aging workload proxy when applicable. */
  agingSignal: number
  /** Human-readable evidence bullets (mirrors supportingMetrics for UI lists). */
  evidence: string[]
}

/** Dashboard / maintenance summary row — same schema as cards plus display text. */
export type OperationalDashboardFinding = DeterministicOperationalInsight & { text: string }

export const INSIGHT_SEVERITY_RANK: Record<OperationalInsightSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export const INSIGHT_CONFIDENCE_RANK: Record<OperationalInsightConfidence, number> = {
  heuristic: 1,
  "strong-signal": 2,
  "confirmed-pattern": 3,
}

/** Presentation tier for UI chrome (distinct from raw severity when needed). */
export type OperationalInsightPresentation = "critical" | "warning" | "informational" | "healthy"

export function presentationFromInsight(insight: {
  severity: OperationalInsightSeverity
  urgency: OperationalInsightUrgency
}): OperationalInsightPresentation {
  if (insight.severity === "critical" || insight.urgency === "immediate") return "critical"
  if (insight.severity === "high" || insight.urgency === "soon") return "warning"
  if (insight.severity === "medium") return "informational"
  return "informational"
}

export function presentationFromFinding(f: Pick<OperationalDashboardFinding, "severity" | "urgency">): OperationalInsightPresentation {
  return presentationFromInsight(f)
}

export function computeImpactScore(
  severity: OperationalInsightSeverity,
  supportingMetrics: SupportingMetric[],
): number {
  let s = INSIGHT_SEVERITY_RANK[severity] * 25
  for (const m of supportingMetrics) {
    if (typeof m.value === "number" && Number.isFinite(m.value)) {
      s += Math.min(Math.abs(m.value), 80)
    }
  }
  return Math.round(s)
}

export function urgencyFromSeverity(severity: OperationalInsightSeverity): OperationalInsightUrgency {
  if (severity === "critical") return "immediate"
  if (severity === "high" || severity === "medium") return "soon"
  return "routine"
}

/** Refine urgency when we have explicit scheduling debt numbers. */
export function refineUrgency(
  base: OperationalInsightUrgency,
  scheduledPastActive: number,
  pastDuePm: number,
): OperationalInsightUrgency {
  if (base === "immediate") return "immediate"
  if (scheduledPastActive >= 5 || pastDuePm >= 8) return "immediate"
  if (scheduledPastActive >= 2 || pastDuePm >= 3) return "soon"
  return base
}

export function compareOperationalInsights(
  a: DeterministicOperationalInsight,
  b: DeterministicOperationalInsight,
): number {
  const sev = INSIGHT_SEVERITY_RANK[b.severity] - INSIGHT_SEVERITY_RANK[a.severity]
  if (sev !== 0) return sev
  if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore
  const conf = INSIGHT_CONFIDENCE_RANK[b.confidence] - INSIGHT_CONFIDENCE_RANK[a.confidence]
  if (conf !== 0) return conf
  return b.agingSignal - a.agingSignal
}

export function compareDashboardFindings(a: OperationalDashboardFinding, b: OperationalDashboardFinding): number {
  const sev = INSIGHT_SEVERITY_RANK[b.severity] - INSIGHT_SEVERITY_RANK[a.severity]
  if (sev !== 0) return sev
  if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore
  const conf = INSIGHT_CONFIDENCE_RANK[b.confidence] - INSIGHT_CONFIDENCE_RANK[a.confidence]
  if (conf !== 0) return conf
  return b.agingSignal - a.agingSignal
}

export type CreateOperationalInsightInput = {
  id: string
  title: string
  detail: string
  triggerRationale: string
  thresholdsUsed: string[]
  severity: OperationalInsightSeverity
  confidence: OperationalInsightConfidence
  category: OperationalInsightCategory
  urgency?: OperationalInsightUrgency
  recommendationType: OperationalRecommendationType
  actionability: OperationalInsightActionability
  supportingMetrics: SupportingMetric[]
  suggestedNextStep: string
  relevantModule: OperationalModuleContext
  suggestedWorkflow: string
  agingSignal: number
  scheduledPastActive?: number
  pastDuePm?: number
}

export function createOperationalInsight(input: CreateOperationalInsightInput): DeterministicOperationalInsight {
  const urgency = refineUrgency(
    input.urgency ?? urgencyFromSeverity(input.severity),
    input.scheduledPastActive ?? 0,
    input.pastDuePm ?? 0,
  )
  const impactScore = computeImpactScore(input.severity, input.supportingMetrics)
  const evidence = input.supportingMetrics.map((m) => `${m.label}: ${m.value}`)
  return {
    id: input.id,
    title: input.title,
    detail: input.detail,
    triggerRationale: input.triggerRationale,
    thresholdsUsed: input.thresholdsUsed,
    severity: input.severity,
    confidence: input.confidence,
    category: input.category,
    urgency,
    recommendationType: input.recommendationType,
    actionability: input.actionability,
    supportingMetrics: input.supportingMetrics,
    suggestedNextStep: input.suggestedNextStep,
    relevantModule: input.relevantModule,
    suggestedWorkflow: input.suggestedWorkflow,
    impactScore,
    agingSignal: input.agingSignal,
    evidence,
  }
}

export function createDashboardFinding(
  input: CreateOperationalInsightInput & { text: string },
): OperationalDashboardFinding {
  return { ...createOperationalInsight(input), text: input.text }
}

