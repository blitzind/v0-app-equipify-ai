/**
 * Deterministic recommendation prioritization and executive summary strings (no LLM).
 */

import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import type { BlitzpayPhase4aReportingScores } from "@/lib/blitzpay/blitzpay-ai-snapshot-scores"

export type BlitzpayAiInsightType =
  | "anomaly"
  | "treasury_risk"
  | "margin_risk"
  | "collections"
  | "payroll"
  | "procurement"
  | "membership"
  | "financing"
  | "vendor_risk"
  | "executive_summary"

export type BlitzpayAiActionType =
  | "review"
  | "follow_up"
  | "pricing_review"
  | "collections_review"
  | "treasury_review"
  | "payroll_review"
  | "procurement_review"
  | "vendor_review"
  | "membership_review"

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export type BlitzpayAiPrioritizedInsight = {
  insight_type: BlitzpayAiInsightType
  severity: "low" | "medium" | "high" | "critical"
  deterministic_score: number
  title: string
  summary: string
  recommendation_summary: string
  supporting_metrics: Record<string, number | string | boolean>
  generated_by: "deterministic_engine" | "hybrid"
  ai_reasoning_summary: string | null
}

export function defaultActionTypeForInsight(insightType: BlitzpayAiInsightType): BlitzpayAiActionType {
  switch (insightType) {
    case "collections":
      return "collections_review"
    case "treasury_risk":
      return "treasury_review"
    case "payroll":
      return "payroll_review"
    case "procurement":
      return "procurement_review"
    case "vendor_risk":
      return "vendor_review"
    case "membership":
      return "membership_review"
    case "margin_risk":
      return "pricing_review"
    case "financing":
      return "review"
    case "executive_summary":
      return "follow_up"
    default:
      return "review"
  }
}

export function compareInsightsDeterministic(a: BlitzpayAiPrioritizedInsight, b: BlitzpayAiPrioritizedInsight): number {
  const sr = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
  if (sr !== 0) return sr
  if (b.deterministic_score !== a.deterministic_score) return b.deterministic_score - a.deterministic_score
  return String(a.insight_type).localeCompare(String(b.insight_type))
}

export function sortInsightsDeterministic(rows: BlitzpayAiPrioritizedInsight[]): BlitzpayAiPrioritizedInsight[] {
  return [...rows].sort(compareInsightsDeterministic)
}

export function buildExecutiveFinancialSummaryLines(
  reporting: BlitzpayOrgReportingSnapshot,
  scores: BlitzpayPhase4aReportingScores,
): { title: string; summary: string; bullets: string[] } {
  const bullets: string[] = []
  bullets.push(
    `Composite operational risk score is ${scores.aiFinancialRiskScore}/100 (deterministic blend of treasury, margin, collections, payroll, vendor, membership, and financing signals).`,
  )
  bullets.push(
    `Treasury pressure ${scores.treasuryPressureScore}/100; cash runway label: ${reporting.cashRunwayStatus}. Operating cash (internal estimate): ${formatUsd(reporting.estimatedOperatingCashCents)}.`,
  )
  bullets.push(
    `Collections optimization headroom ${scores.collectionsOptimizationScore}/100; collection success rate ${Math.round(reporting.collectionSuccessRate)}%.`,
  )
  bullets.push(
    `Payroll pressure ${scores.payrollPressureScore}/100; procurement planning efficiency ${scores.procurementEfficiencyScore}/100 (higher is healthier).`,
  )
  bullets.push(`Vendor concentration risk ${scores.vendorConcentrationRiskScore}/100; insight data coverage ${scores.aiInsightCoverageRate}/100.`)
  return {
    title: "Executive financial snapshot",
    summary:
      "Operational recommendations derived from current BlitzPay reporting aggregates. Review with your finance lead before operational changes — nothing here moves money automatically.",
    bullets: bullets.slice(0, 8),
  }
}

function formatUsd(cents: number): string {
  const n = Math.round(cents) / 100
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

/** Template “hybrid” line — bounded, no provider prompts, not authoritative. */
export function buildAdvisoryReasoningLine(ctx: {
  insight_type: BlitzpayAiInsightType
  deterministic_score: number
  keyMetricLabel: string
  keyMetricValue: string | number
}): string {
  return `Operational read: ${ctx.insight_type.replace(/_/g, " ")} priority ${ctx.deterministic_score}/100 — ${ctx.keyMetricLabel}: ${String(ctx.keyMetricValue)}. Confirm with your team before acting.`
}
