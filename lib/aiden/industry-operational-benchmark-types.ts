/**
 * Anonymized industry operational benchmarks — types only (safe for client bundles).
 */

export const INDUSTRY_BENCHMARK_METRIC_KEYS = [
  "pm_backlog_ratio",
  "work_order_schedule_slip_ratio",
  "work_order_stale_ratio",
  "dispatch_unassigned_ratio",
  "emergency_work_share_90d",
  "inspection_slip_active_count",
  "repeat_equipment_stress_index",
  "invoice_overdue_ratio",
] as const

export type IndustryBenchmarkMetricKey = (typeof INDUSTRY_BENCHMARK_METRIC_KEYS)[number]

export type IndustryBenchmarkSampleStatus =
  | "ready"
  | "insufficient_aggregate_data"
  | "insufficient_industry_sample"

export type IndustryBenchmarkPosition = "favorable" | "typical" | "elevated" | "unavailable"

export type IndustryBenchmarkVersusMedian = "below" | "inline" | "above" | "unknown"

export type IndustryBenchmarkComparison = {
  metricKey: IndustryBenchmarkMetricKey
  metricTitle: string
  /** When true, lower raw values are healthier (ratios / backlog-style metrics). */
  lowerIsBetter: boolean
  /** Unitless ratio or count depending on metric; null when not computable for this org. */
  yourValue: number | null
  yourValueDescription: string
  industryP25: number | null
  industryP50: number | null
  industryP75: number | null
  industryOrgsContributing: number | null
  /** Where the org sits vs the published anonymous band. */
  position: IndustryBenchmarkPosition
  versusMedian: IndustryBenchmarkVersusMedian
  explainability: string
  operationalRecommendation: string
}

export type IndustryBenchmarkIntelligence = {
  generatedAt: string
  industryKey: string | null
  reportingWindowDays: number
  sampleStatus: IndustryBenchmarkSampleStatus
  minimumOrgsRequired: number
  comparisons: IndustryBenchmarkComparison[]
  privacyFootnote: string
  methodologyFootnote: string
}
