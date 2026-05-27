import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  normalizeSignalWatchlistFilters,
  type GrowthSignalWatchlistFilters,
  type GrowthSignalWatchlistMatchReason,
  type GrowthSignalWatchlistRow,
} from "@/lib/growth/signals/signal-watchlist-types"
import type {
  GrowthSignalTriggerConditions,
  GrowthSignalTriggerRuleRow,
  GrowthSignalTriggerSuggestion,
} from "@/lib/growth/signals/signal-trigger-rule-types"

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

function readHiringIntensity(metadata: Record<string, unknown> | undefined): string | null {
  const velocity = metadata?.hiring_velocity
  if (!velocity || typeof velocity !== "object") return null
  const intensity = (velocity as Record<string, unknown>).hiring_intensity
  return typeof intensity === "string" && intensity.trim() ? intensity.trim() : null
}

function readDepartment(signal: GrowthSignalRow): string | null {
  return signal.category?.trim() || null
}

export function buildSignalWatchlistMatchReason(
  signal: GrowthSignalRow,
  filters: GrowthSignalWatchlistFilters,
): GrowthSignalWatchlistMatchReason {
  const reason: GrowthSignalWatchlistMatchReason = {}
  if (filters.signal_types?.length) reason.matched_signal_type = signal.signal_type
  if (filters.company && includesFold(signal.company_name, filters.company)) {
    reason.matched_company = filters.company
  }
  if (filters.domain && includesFold(signal.domain, filters.domain)) {
    reason.matched_domain = filters.domain
  }
  if (filters.category && includesFold(readDepartment(signal), filters.category)) {
    reason.matched_category = filters.category
  }
  if (filters.department && includesFold(readDepartment(signal), filters.department)) {
    reason.matched_department = filters.department
  }
  if (filters.hiring_intensity) {
    const intensity = readHiringIntensity(signal.metadata)
    if (intensity && intensity.toLowerCase() === filters.hiring_intensity.toLowerCase()) {
      reason.matched_hiring_intensity = filters.hiring_intensity
    }
  }
  if (filters.minimum_signal_score != null && signal.signal_score >= filters.minimum_signal_score) {
    reason.matched_score_threshold = filters.minimum_signal_score
  }
  if (filters.geography && includesFold(signal.geography, filters.geography)) {
    reason.matched_geography = filters.geography
  }
  return reason
}

export function signalMatchesWatchlistFilters(
  signal: GrowthSignalRow,
  watchlist: Pick<GrowthSignalWatchlistRow, "signal_types" | "filters">,
): { matched: boolean; reason: GrowthSignalWatchlistMatchReason } {
  const filters = normalizeSignalWatchlistFilters(watchlist.filters)
  const allowedTypes =
    watchlist.signal_types.length > 0 ? watchlist.signal_types : filters.signal_types ?? []

  if (allowedTypes.length > 0 && !allowedTypes.includes(signal.signal_type)) {
    return { matched: false, reason: {} }
  }

  if (filters.workflow_state && signal.workflow_state !== filters.workflow_state) {
    return { matched: false, reason: {} }
  }
  if (filters.suppression_state && signal.suppression_state !== filters.suppression_state) {
    return { matched: false, reason: {} }
  }
  if (filters.urgency && signal.urgency !== filters.urgency) {
    return { matched: false, reason: {} }
  }
  if (filters.minimum_signal_score != null && signal.signal_score < filters.minimum_signal_score) {
    return { matched: false, reason: {} }
  }
  if (filters.company && !includesFold(signal.company_name, filters.company)) {
    return { matched: false, reason: {} }
  }
  if (filters.domain && !includesFold(signal.domain, filters.domain)) {
    return { matched: false, reason: {} }
  }
  if (filters.category) {
    const dept = readDepartment(signal)
    if (!includesFold(dept, filters.category) && !includesFold(signal.evidence_summary, filters.category)) {
      return { matched: false, reason: {} }
    }
  }
  if (filters.department) {
    const dept = readDepartment(signal)
    if (!includesFold(dept, filters.department)) {
      return { matched: false, reason: {} }
    }
  }
  if (filters.hiring_intensity) {
    const intensity = readHiringIntensity(signal.metadata)
    if (!intensity || intensity.toLowerCase() !== filters.hiring_intensity.toLowerCase()) {
      return { matched: false, reason: {} }
    }
  }
  if (filters.geography && !includesFold(signal.geography, filters.geography)) {
    return { matched: false, reason: {} }
  }
  if (filters.occurred_from) {
    const ms = Date.parse(signal.occurred_at)
    const fromMs = Date.parse(filters.occurred_from)
    if (!Number.isFinite(ms) || !Number.isFinite(fromMs) || ms < fromMs) {
      return { matched: false, reason: {} }
    }
  }
  if (filters.occurred_to) {
    const ms = Date.parse(signal.occurred_at)
    const toMs = Date.parse(filters.occurred_to)
    if (!Number.isFinite(ms) || !Number.isFinite(toMs) || ms > toMs) {
      return { matched: false, reason: {} }
    }
  }

  return { matched: true, reason: buildSignalWatchlistMatchReason(signal, filters) }
}

export function evaluateSignalWatchlist(
  watchlist: Pick<GrowthSignalWatchlistRow, "id" | "signal_types" | "filters">,
  signals: GrowthSignalRow[],
): Array<{ signal: GrowthSignalRow; reason: GrowthSignalWatchlistMatchReason }> {
  return signals
    .map((signal) => {
      const result = signalMatchesWatchlistFilters(signal, watchlist)
      return result.matched ? { signal, reason: result.reason } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}

function normalizeTriggerConditions(input: GrowthSignalTriggerConditions): GrowthSignalTriggerConditions {
  return {
    signal_types: Array.isArray(input.signal_types)
      ? input.signal_types.filter((value) => typeof value === "string" && value.trim())
      : undefined,
    minimum_signal_score:
      typeof input.minimum_signal_score === "number" && Number.isFinite(input.minimum_signal_score)
        ? input.minimum_signal_score
        : null,
    urgency: typeof input.urgency === "string" && input.urgency.trim() ? input.urgency.trim() : null,
    category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
    department: typeof input.department === "string" && input.department.trim() ? input.department.trim() : null,
    hiring_intensity:
      typeof input.hiring_intensity === "string" && input.hiring_intensity.trim()
        ? input.hiring_intensity.trim()
        : null,
    workflow_state:
      typeof input.workflow_state === "string" && input.workflow_state.trim()
        ? input.workflow_state.trim()
        : null,
    suppression_state:
      typeof input.suppression_state === "string" && input.suppression_state.trim()
        ? input.suppression_state.trim()
        : null,
  }
}

export function signalMatchesTriggerConditions(
  signal: GrowthSignalRow,
  conditions: GrowthSignalTriggerConditions,
): { matched: boolean; reason: Record<string, unknown> } {
  const normalized = normalizeTriggerConditions(conditions)
  const pseudoWatchlist = {
    signal_types: (normalized.signal_types ?? []) as GrowthSignalWatchlistRow["signal_types"],
    filters: normalizeSignalWatchlistFilters({
      signal_types: normalized.signal_types as GrowthSignalWatchlistRow["signal_types"],
      minimum_signal_score: normalized.minimum_signal_score,
      urgency: normalized.urgency,
      category: normalized.category,
      department: normalized.department,
      hiring_intensity: normalized.hiring_intensity,
      workflow_state: normalized.workflow_state as GrowthSignalWatchlistFilters["workflow_state"],
      suppression_state: normalized.suppression_state as GrowthSignalWatchlistFilters["suppression_state"],
    }),
  }
  const result = signalMatchesWatchlistFilters(signal, pseudoWatchlist)
  return { matched: result.matched, reason: result.reason }
}

/** Manual evaluation only — returns suggestions, never executes actions. */
export function evaluateSignalTriggerRule(
  rule: Pick<
    GrowthSignalTriggerRuleRow,
    "id" | "name" | "enabled" | "conditions" | "actions" | "safety_mode"
  >,
  signals: GrowthSignalRow[],
): GrowthSignalTriggerSuggestion[] {
  if (!rule.enabled || rule.safety_mode === "disabled") return []

  const suggestions: GrowthSignalTriggerSuggestion[] = []
  for (const signal of signals) {
    const match = signalMatchesTriggerConditions(signal, rule.conditions)
    if (!match.matched) continue

    const suggested_actions: string[] = []
    if (rule.actions.suggest_review) suggested_actions.push("suggest_review")
    if (rule.actions.suggest_watchlist) suggested_actions.push("suggest_watchlist")
    if (rule.actions.suggest_route) suggested_actions.push("suggest_route")
    if (suggested_actions.length === 0) suggested_actions.push("manual_review")

    suggestions.push({
      rule_id: rule.id,
      rule_name: rule.name,
      signal_id: signal.id,
      safety_mode: rule.safety_mode,
      suggested_actions,
      match_reason: match.reason,
    })
  }
  return suggestions
}
