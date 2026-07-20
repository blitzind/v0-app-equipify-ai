/** GE-AIOS-NEXT-3B — Research duration evidence (client-safe, timestamp-based). */

import type {
  GrowthEvidenceCompletenessClassification,
  GrowthResearchDurationFinding,
} from "./growth-organizational-evidence-completeness-next-3b-types"

const DEFAULT_STALLED_THRESHOLD_HOURS = 24

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)] ?? null
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid] ?? null
}

export function computeResearchDurationStats(input: {
  completedRuns: Array<{ createdAt: string; completedAt: string }>
  activeRuns: number
  stalledThresholdHours?: number
}): GrowthResearchDurationFinding {
  const threshold = input.stalledThresholdHours ?? DEFAULT_STALLED_THRESHOLD_HOURS
  const durationsHours: number[] = []

  for (const run of input.completedRuns) {
    const start = Date.parse(run.createdAt)
    const end = Date.parse(run.completedAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    durationsHours.push((end - start) / (1000 * 60 * 60))
  }

  durationsHours.sort((a, b) => a - b)
  const sampleSize = durationsHours.length

  let completeness: GrowthEvidenceCompletenessClassification = "unavailable"
  if (sampleSize >= 10) completeness = "available"
  else if (sampleSize > 0) completeness = "partially_available"
  else if (input.activeRuns > 0) completeness = "insufficient_evidence"

  const medianCompletionHours =
    median(durationsHours) !== null ? Math.round((median(durationsHours)! ) * 10) / 10 : null
  const averageCompletionHours =
    sampleSize > 0
      ? Math.round((durationsHours.reduce((a, b) => a + b, 0) / sampleSize) * 10) / 10
      : null
  const p90CompletionHours =
    percentile(durationsHours, 90) !== null
      ? Math.round(percentile(durationsHours, 90)! * 10) / 10
      : null

  const stalledBeyondThreshold =
    input.activeRuns +
    durationsHours.filter((hours) => hours > threshold).length

  return {
    completeness,
    completedSampleSize: sampleSize,
    medianCompletionHours,
    averageCompletionHours,
    p90CompletionHours,
    stalledBeyondThreshold,
    stalledThresholdHours: threshold,
    completenessNote:
      sampleSize === 0
        ? "No completed research runs with trustworthy created/completed timestamps in the observation window."
        : sampleSize < 10
          ? `Sample size ${sampleSize} — duration distribution is indicative, not definitive.`
          : null,
  }
}
