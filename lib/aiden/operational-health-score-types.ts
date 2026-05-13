/**
 * Deterministic operational health scores for AIden / AI Ops — shared types (no server imports).
 * Scores are bounded indices from live counts, not predictions or diagnoses.
 */

import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

export const OPERATIONAL_HEALTH_CATEGORY_IDS = [
  "preventive_maintenance_health",
  "asset_readiness",
  "dispatch_efficiency",
  "inspection_compliance",
  "operational_responsiveness",
  "work_order_backlog_health",
  "financial_workflow_completion",
] as const

export type OperationalHealthCategoryId = (typeof OPERATIONAL_HEALTH_CATEGORY_IDS)[number]

export const OPERATIONAL_HEALTH_OVERALL_BANDS = [
  "at_risk",
  "needs_attention",
  "stable",
  "strong",
  "optimized",
] as const

export type OperationalHealthOverallBand = (typeof OPERATIONAL_HEALTH_OVERALL_BANDS)[number]

export type OperationalHealthFactorImpact = "positive" | "negative" | "neutral"

export type OperationalHealthContributingFactor = {
  label: string
  impact: OperationalHealthFactorImpact
  /** Raw value shown to the operator (count, ratio text, or "n/a"). */
  value: string | number
  /** How this factor moved the score (plain language, references thresholds). */
  detail: string
}

export type OperationalHealthCategoryScore = {
  id: OperationalHealthCategoryId
  /** Display title */
  title: string
  /** 0–100 inclusive; higher is healthier for this slice. */
  score: number
  /** When null, category was excluded from the weighted overall (insufficient data). */
  scoreIncludedInOverall: boolean
  contributingFactors: OperationalHealthContributingFactor[]
  /** One-line explanation of how industry weights applied to this slice. */
  weightedLogicNote: string
  recommendation: string
  operationalGaps: string[]
}

export type OperationalHealthScoresReport = {
  generatedAt: string
  /** Workspace vertical used for weighting (null → generic field template). */
  industryKey: WorkspaceIndustryKey | null
  /**
   * Industry key used only for title-keyword sampling in metrics fetch when workspace vertical is unset.
   * Omitted when identical to industryKey.
   */
  metricsSamplingIndustryKey?: WorkspaceIndustryKey
  /** 0–100 weighted rollup of included categories only. */
  overallScore: number
  overallBand: OperationalHealthOverallBand
  overallLabel: string
  overallSummary: string
  categories: OperationalHealthCategoryScore[]
  /** Weights actually used (after industry override + renormalization for null categories). */
  weightsUsed: Record<OperationalHealthCategoryId, number>
  methodologyNote: string
  limitations: string[]
}
