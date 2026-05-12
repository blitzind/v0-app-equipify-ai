/**
 * Deterministic experiment summaries (basis points; integer math only).
 */

export type ExperimentSummaryInput = {
  baselineValue: number | null
  observedValue: number | null
}

/** Estimated lift in basis points from baseline vs observed (signed). */
export function computeExperimentLiftBasisPoints(input: ExperimentSummaryInput): number | null {
  if (input.baselineValue == null || input.observedValue == null) return null
  const b = Math.max(1, Math.abs(Math.round(input.baselineValue)))
  const o = Math.round(input.observedValue)
  const raw = Math.floor(((o - b) * 10_000) / b)
  return Math.max(-10_000, Math.min(10_000, raw))
}

export function formatExperimentLiftSummary(bps: number | null): string {
  if (bps == null) return "Insufficient data for lift estimate."
  if (bps === 0) return "No measured lift versus baseline."
  const pct = (bps / 100).toFixed(1)
  return bps > 0
    ? `Estimated lift of about ${pct}% versus control (deterministic read).`
    : `Observed gap of about ${Math.abs(Number(pct))}% versus baseline (review before acting).`
}
