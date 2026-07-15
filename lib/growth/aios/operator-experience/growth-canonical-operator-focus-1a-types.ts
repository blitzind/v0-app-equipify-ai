/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Canonical operator focus types (client-safe).
 */

export const GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER =
  "ge-aios-operator-story-implementation-1a-v1" as const

export type GrowthCanonicalOperatorFocusSource =
  | "approval"
  | "mission_blocker"
  | "decision"
  | "revenue_queue"

export type GrowthCanonicalOperatorFocus = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER
  leadId: string
  companyName: string
  source: GrowthCanonicalOperatorFocusSource
  title: string
  detail: string | null
  href: string
  priorityRank: number
}
