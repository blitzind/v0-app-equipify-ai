/** GE-AIOS-NEXT-1B — Intent-led recommendation presentation types (client-safe). */

export const GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER =
  "ge-aios-next-1b-ava-intent-recommendation-home-v1" as const

export type GrowthHomeAvaRecommendationExplanation = {
  whyChosen: string[]
  expectedOutcome: string | null
  estimatedEffortLabel: string | null
  postponementRisk: string | null
  confidenceLabel: string | null
}

export type GrowthHomeAvaMissionIntentKind =
  | "shift_market_focus"
  | "find_leads"
  | "finish_account_work"
  | "increase_meetings"
  | "similar_accounts"
  | "portfolio_review"
  | "continue_prior_work"
  | "focus_account"
  | "general_assignment"

export type GrowthHomeAvaMissionIntentInterpretation = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER
  intentKind: GrowthHomeAvaMissionIntentKind
  understoodIntent: string
  restatement: string
  objectiveShiftLabel: string | null
  planSummary: string
  beforeBeginSteps: string[]
  estimatedEffortLabel: string | null
  expectedOutcome: string | null
  href: string | null
  requiresConfirmation: boolean
  conflictNote: string | null
}

export const GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS = [
  "Another good option would be to",
  "If you'd rather focus somewhere else,",
  "I also think we should",
] as const
