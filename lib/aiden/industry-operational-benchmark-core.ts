import type {
  IndustryBenchmarkComparison,
  IndustryBenchmarkMetricKey,
  IndustryBenchmarkPosition,
  IndustryBenchmarkVersusMedian,
} from "@/lib/aiden/industry-operational-benchmark-types"
import { INDUSTRY_BENCHMARK_METRIC_KEYS } from "@/lib/aiden/industry-operational-benchmark-types"

export const INDUSTRY_BENCHMARK_MIN_ORGS = 20

export type IndustryBenchmarkSnapshotRow = {
  industry_key: string
  metric_key: string
  reporting_window_days: number
  orgs_contributing: number
  p10: number | null
  p25: number | null
  p50: number | null
  p75: number | null
  p90: number | null
  mean: number | null
  methodology_version: string
  computed_at: string
}

function epsilonForMetric(key: IndustryBenchmarkMetricKey): number {
  if (key === "inspection_slip_active_count") return 0.5
  return 0.0005
}

export function percentileLinear(sortedAsc: number[], p: number): number | null {
  const a = [...sortedAsc].filter((x) => Number.isFinite(x)).sort((x, y) => x - y)
  if (a.length === 0) return null
  if (a.length === 1) return a[0]!
  const idx = (a.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return a[lo]!
  return a[lo]! + (a[hi]! - a[lo]!) * (idx - lo)
}

export function computePercentiles(values: number[]): {
  p10: number | null
  p25: number | null
  p50: number | null
  p75: number | null
  p90: number | null
  mean: number | null
} {
  const a = values.filter((x) => Number.isFinite(x))
  if (a.length === 0) {
    return { p10: null, p25: null, p50: null, p75: null, p90: null, mean: null }
  }
  const sum = a.reduce((s, x) => s + x, 0)
  return {
    p10: percentileLinear(a, 0.1),
    p25: percentileLinear(a, 0.25),
    p50: percentileLinear(a, 0.5),
    p75: percentileLinear(a, 0.75),
    p90: percentileLinear(a, 0.9),
    mean: sum / a.length,
  }
}

function versusMedian(yours: number, p50: number | null, key: IndustryBenchmarkMetricKey): IndustryBenchmarkVersusMedian {
  if (p50 === null || !Number.isFinite(yours)) return "unknown"
  const e = epsilonForMetric(key)
  if (Math.abs(yours - p50) <= e) return "inline"
  return yours < p50 ? "below" : "above"
}

function positionFromBands(
  yours: number,
  p25: number | null,
  p50: number | null,
  p75: number | null,
  lowerIsBetter: boolean,
  key: IndustryBenchmarkMetricKey,
): IndustryBenchmarkPosition {
  if (p25 === null || p50 === null || p75 === null) return "unavailable"
  const e = epsilonForMetric(key)
  if (lowerIsBetter) {
    if (yours <= p25 + e) return "favorable"
    if (yours >= p75 - e) return "elevated"
    return "typical"
  }
  if (yours >= p75 - e) return "favorable"
  if (yours <= p25 + e) return "elevated"
  return "typical"
}

function explainLine(
  key: IndustryBenchmarkMetricKey,
  yours: number,
  p25: number | null,
  p50: number | null,
  p75: number | null,
  lowerIsBetter: boolean,
  position: IndustryBenchmarkPosition,
): string {
  if (position === "unavailable") {
    return "Industry distribution is not published for this metric (aggregate sample below the platform minimum)."
  }
  const band =
    p25 !== null && p50 !== null && p75 !== null ?
      `Anonymous peer band (same industry, same window): ~${fmt(key, p25)} / ~${fmt(key, p50)} / ~${fmt(key, p75)} (p25 / p50 / p75).`
    : ""
  let rel: string
  if (lowerIsBetter) {
    if (position === "favorable") rel = "Your workspace sits in the lower (healthier) tail for this metric."
    else if (position === "elevated") rel = "Your workspace sits in the upper (more stressed) tail versus peers."
    else rel = "Your workspace sits near the middle of the anonymous peer distribution."
  } else {
    if (position === "favorable") rel = "Your workspace sits in the upper tail for this metric."
    else if (position === "elevated") rel = "Your workspace sits in the lower tail versus peers."
    else rel = "Your workspace sits near the middle of the anonymous peer distribution."
  }
  return `Your value: ${fmt(key, yours)}. ${band} ${rel}`
}

function fmt(key: IndustryBenchmarkMetricKey, v: number): string {
  if (key === "inspection_slip_active_count") return String(Math.round(v * 10) / 10)
  return `${Math.round(v * 1000) / 10}%`
}

function recommend(
  key: IndustryBenchmarkMetricKey,
  position: IndustryBenchmarkPosition,
  lowerIsBetter: boolean,
): string {
  if (position === "unavailable") {
    return "Run the platform aggregate job when enough anonymized workspaces exist — no peer comparison is shown until then."
  }
  if (position === "favorable") {
    return lowerIsBetter ?
        "Keep monitoring — your stress signal is lighter than most peers for this slice."
      : "Keep monitoring — you outperform the median on this construct."
  }
  if (position === "elevated") {
    switch (key) {
      case "pm_backlog_ratio":
        return "Reconcile PM schedules and close completed visits so active plans reflect reality."
      case "work_order_schedule_slip_ratio":
      case "work_order_stale_ratio":
        return "Triage active jobs: reschedule slipped dates and touch stale tickets weekly."
      case "dispatch_unassigned_ratio":
        return "Assign owners to unassigned active work before adding net-new dispatch load."
      case "emergency_work_share_90d":
        return "Review emergency intake drivers (asset class, customer) and rebalance planned work."
      case "inspection_slip_active_count":
        return "Clear inspection jobs that are still active past their scheduled date."
      case "repeat_equipment_stress_index":
        return "Investigate repeat emergency patterns on the same equipment ids."
      case "invoice_overdue_ratio":
        return "Tighten collections cadence on overdue-but-open invoices in the sampled queue."
      default:
        return "Review operational drivers for this metric with your leads."
    }
  }
  return "Hold steady — you are near the anonymous peer median for this construct."
}

export function buildComparisonForMetric(args: {
  metricKey: IndustryBenchmarkMetricKey
  metricTitle: string
  lowerIsBetter: boolean
  yourValue: number | null
  snapshot: IndustryBenchmarkSnapshotRow | null
}): IndustryBenchmarkComparison {
  const { metricKey, metricTitle, lowerIsBetter, yourValue, snapshot } = args
  if (yourValue === null || !Number.isFinite(yourValue)) {
    return {
      metricKey,
      metricTitle,
      lowerIsBetter,
      yourValue: null,
      yourValueDescription: "Not enough local activity to compute this ratio (denominator was zero or sample empty).",
      industryP25: snapshot?.p25 ?? null,
      industryP50: snapshot?.p50 ?? null,
      industryP75: snapshot?.p75 ?? null,
      industryOrgsContributing: snapshot?.orgs_contributing ?? null,
      position: "unavailable",
      versusMedian: "unknown",
      explainability:
        "This workspace did not produce a finite value for the metric (for example, no active work orders in scope).",
      operationalRecommendation:
        "Populate the underlying operational records, then refresh — comparisons require a defined local signal.",
    }
  }

  if (
    !snapshot ||
    snapshot.orgs_contributing < INDUSTRY_BENCHMARK_MIN_ORGS ||
    snapshot.p25 === null ||
    snapshot.p50 === null ||
    snapshot.p75 === null
  ) {
    return {
      metricKey,
      metricTitle,
      lowerIsBetter,
      yourValue,
      yourValueDescription: `Observed value for this org: ${fmt(metricKey, yourValue)}.`,
      industryP25: snapshot?.p25 ?? null,
      industryP50: snapshot?.p50 ?? null,
      industryP75: snapshot?.p75 ?? null,
      industryOrgsContributing: snapshot?.orgs_contributing ?? null,
      position: "unavailable",
      versusMedian: "unknown",
      explainability:
        "Equipify only shows peer bands when the latest aggregate snapshot includes enough anonymized workspaces — this avoids noisy or misleading benchmarks.",
      operationalRecommendation:
        "No automated peer comparison is emitted until the aggregate job publishes a statistically meaningful row.",
    }
  }

  const position = positionFromBands(yourValue, snapshot.p25, snapshot.p50, snapshot.p75, lowerIsBetter, metricKey)
  const vm = versusMedian(yourValue, snapshot.p50, metricKey)

  return {
    metricKey,
    metricTitle,
    lowerIsBetter,
    yourValue,
    yourValueDescription: `Observed value for this org: ${fmt(metricKey, yourValue)}.`,
    industryP25: snapshot.p25,
    industryP50: snapshot.p50,
    industryP75: snapshot.p75,
    industryOrgsContributing: snapshot.orgs_contributing,
    position,
    versusMedian: vm,
    explainability: explainLine(metricKey, yourValue, snapshot.p25, snapshot.p50, snapshot.p75, lowerIsBetter, position),
    operationalRecommendation: recommend(metricKey, position, lowerIsBetter),
  }
}

export function dedupeLatestSnapshots(rows: IndustryBenchmarkSnapshotRow[]): Map<IndustryBenchmarkMetricKey, IndustryBenchmarkSnapshotRow> {
  const m = new Map<IndustryBenchmarkMetricKey, IndustryBenchmarkSnapshotRow>()
  for (const r of rows) {
    const k = r.metric_key as IndustryBenchmarkMetricKey
    if (!INDUSTRY_BENCHMARK_METRIC_KEYS.includes(k)) continue
    if (!m.has(k)) m.set(k, r)
  }
  return m
}
