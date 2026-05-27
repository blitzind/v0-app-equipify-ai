import { GROWTH_SIGNAL_TYPES, GROWTH_SIGNAL_WORKFLOW_STATES, GROWTH_SIGNAL_SUPPRESSION_STATES, type GrowthSignalType, type GrowthSignalWorkflowState, type GrowthSignalSuppressionState } from "@/lib/growth/signals/signal-types"

export const GROWTH_SIGNAL_WATCHLISTS_QA_MARKER = "growth-signal-watchlists-v1" as const

export const GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES = GROWTH_SIGNAL_TYPES

export type GrowthSignalWatchlistFilters = {
  signal_types?: GrowthSignalType[]
  company?: string | null
  domain?: string | null
  category?: string | null
  urgency?: string | null
  minimum_signal_score?: number | null
  geography?: string | null
  department?: string | null
  hiring_intensity?: string | null
  occurred_from?: string | null
  occurred_to?: string | null
  workflow_state?: GrowthSignalWorkflowState | null
  suppression_state?: GrowthSignalSuppressionState | null
}

export type GrowthSignalWatchlistMatchReason = {
  matched_signal_type?: string | null
  matched_company?: string | null
  matched_category?: string | null
  matched_score_threshold?: number | null
  matched_department?: string | null
  matched_hiring_intensity?: string | null
  matched_geography?: string | null
  matched_domain?: string | null
}

export type GrowthSignalWatchlistRow = {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  signal_types: GrowthSignalType[]
  filters: GrowthSignalWatchlistFilters
  match_count: number
  last_evaluated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  metadata: Record<string, unknown>
}

export type GrowthSignalWatchlistMatchRow = {
  id: string
  organization_id: string | null
  watchlist_id: string
  signal_id: string
  matched_at: string
  match_reason: GrowthSignalWatchlistMatchReason
  created_at: string
}

export const GROWTH_SIGNAL_SAFE_ACTIONS = [
  "suppress",
  "dismiss",
  "mark_reviewed",
  "add_to_watchlist",
] as const

export type GrowthSignalSafeAction = (typeof GROWTH_SIGNAL_SAFE_ACTIONS)[number]

export const GROWTH_SIGNAL_BLOCKED_ACTIONS = [
  "auto_send",
  "auto_sequence",
  "auto_enroll",
  "auto_outreach",
] as const

export type GrowthSignalBlockedAction = (typeof GROWTH_SIGNAL_BLOCKED_ACTIONS)[number]

export function normalizeSignalWatchlistFilters(
  input: Partial<GrowthSignalWatchlistFilters> | null | undefined,
): GrowthSignalWatchlistFilters {
  const raw = input ?? {}
  const signal_types = Array.isArray(raw.signal_types)
    ? raw.signal_types.filter((t): t is GrowthSignalType => GROWTH_SIGNAL_TYPES.includes(t as GrowthSignalType))
    : undefined

  return {
    signal_types: signal_types?.length ? signal_types : undefined,
    company: typeof raw.company === "string" && raw.company.trim() ? raw.company.trim() : null,
    domain: typeof raw.domain === "string" && raw.domain.trim() ? raw.domain.trim() : null,
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : null,
    urgency: typeof raw.urgency === "string" && raw.urgency.trim() ? raw.urgency.trim() : null,
    minimum_signal_score:
      typeof raw.minimum_signal_score === "number" && Number.isFinite(raw.minimum_signal_score)
        ? raw.minimum_signal_score
        : null,
    geography: typeof raw.geography === "string" && raw.geography.trim() ? raw.geography.trim() : null,
    department: typeof raw.department === "string" && raw.department.trim() ? raw.department.trim() : null,
    hiring_intensity:
      typeof raw.hiring_intensity === "string" && raw.hiring_intensity.trim()
        ? raw.hiring_intensity.trim()
        : null,
    occurred_from: typeof raw.occurred_from === "string" && raw.occurred_from.trim() ? raw.occurred_from.trim() : null,
    occurred_to: typeof raw.occurred_to === "string" && raw.occurred_to.trim() ? raw.occurred_to.trim() : null,
    workflow_state:
      raw.workflow_state && GROWTH_SIGNAL_WORKFLOW_STATES.includes(raw.workflow_state as GrowthSignalWorkflowState)
        ? (raw.workflow_state as GrowthSignalWorkflowState)
        : null,
    suppression_state:
      raw.suppression_state &&
      GROWTH_SIGNAL_SUPPRESSION_STATES.includes(raw.suppression_state as GrowthSignalSuppressionState)
        ? (raw.suppression_state as GrowthSignalSuppressionState)
        : null,
  }
}

/** Example watchlist payload for operator docs / tests. */
export const GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD = {
  name: "Medical equipment hiring",
  description: "Track biomedical hiring and news in target accounts",
  signal_types: ["news_event", "job_posting", "hire"],
  filters: {
    category: "Field Service",
    minimum_signal_score: 40,
    hiring_intensity: "medium",
    suppression_state: "active",
  },
} as const
