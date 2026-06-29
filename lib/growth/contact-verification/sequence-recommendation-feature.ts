/**
 * GE-IRE-7C — Sequence recommendation feature flags (client-safe).
 */

export const GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER =
  "sequence-recommendation-panel-v1" as const

export function isSequenceRecommendationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_SEQUENCE_RECOMMENDATION === "true"
}

export function isSequenceRecommendationEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_SEQUENCE_RECOMMENDATION === "true"
}
