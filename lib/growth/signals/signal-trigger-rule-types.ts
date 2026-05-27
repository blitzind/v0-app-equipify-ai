export const GROWTH_SIGNAL_TRIGGER_SAFETY_MODES = [
  "manual_review",
  "suggest_only",
  "disabled",
] as const

export type GrowthSignalTriggerSafetyMode = (typeof GROWTH_SIGNAL_TRIGGER_SAFETY_MODES)[number]

export type GrowthSignalTriggerConditions = {
  signal_types?: string[]
  minimum_signal_score?: number | null
  urgency?: string | null
  category?: string | null
  department?: string | null
  hiring_intensity?: string | null
  workflow_state?: string | null
  suppression_state?: string | null
}

export type GrowthSignalTriggerActions = {
  suggest_review?: boolean
  suggest_watchlist?: boolean
  suggest_route?: boolean
}

export type GrowthSignalTriggerRuleRow = {
  id: string
  organization_id: string | null
  watchlist_id: string | null
  name: string
  description: string | null
  enabled: boolean
  conditions: GrowthSignalTriggerConditions
  actions: GrowthSignalTriggerActions
  safety_mode: GrowthSignalTriggerSafetyMode
  last_evaluated_at: string | null
  last_match_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  metadata: Record<string, unknown>
}

export type GrowthSignalTriggerSuggestion = {
  rule_id: string
  rule_name: string
  signal_id: string
  safety_mode: GrowthSignalTriggerSafetyMode
  suggested_actions: string[]
  match_reason: Record<string, unknown>
}

/** Example trigger rule payload — stored disabled; no automatic execution in Milestone D. */
export const GROWTH_SIGNAL_TRIGGER_RULE_EXAMPLE_PAYLOAD = {
  name: "High urgency hiring spike",
  description: "Suggest review when hire aggregate shows high intensity",
  enabled: false,
  safety_mode: "manual_review",
  conditions: {
    signal_types: ["hire"],
    minimum_signal_score: 55,
    hiring_intensity: "high",
    suppression_state: "active",
  },
  actions: {
    suggest_review: true,
    suggest_watchlist: true,
  },
} as const
