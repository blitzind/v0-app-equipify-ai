/** Deterministic operational signal — not a failure prediction. */
export type ReplacementReadinessLabel =
  | "healthy"
  | "monitor"
  | "consider_replacement"
  | "replacement_recommended"
  | "insufficient_data"

export type ReplacementReadinessResult = {
  label: ReplacementReadinessLabel
  /** 0 = low pressure, 100 = strongest operational signal to plan replacement. */
  riskScore: number
  /** Short, user-facing factors (no dollar amounts). */
  reasons: string[]
  dataQuality: "strong" | "moderate" | "limited"
}
