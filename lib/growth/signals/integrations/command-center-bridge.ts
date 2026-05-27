import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  buildCompanySignalRollup,
  deriveMomentumLabel,
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  type GrowthSignalMomentumLabel,
} from "@/lib/growth/signals/company-signal-rollup"
import {
  formatDepartmentDistribution,
  readHiringVelocityFromMetadata,
} from "@/lib/growth/signals/hiring-velocity-ui-helpers"

export type CommandCenterHiringMetrics = {
  recent_hiring_signals_count: number
  top_hiring_companies: Array<{
    company_name: string
    domain: string | null
    open_role_count: number
    hiring_spike: boolean
  }>
  hiring_spikes: Array<{
    company_name: string
    domain: string | null
    hiring_velocity_7d: number
  }>
}

/**
 * Read-only Command Center hiring metrics helper (Milestone C).
 */
export function buildCommandCenterHiringMetrics(input: {
  job_postings?: GrowthSignalRow[]
  hire_signals?: GrowthSignalRow[]
}): CommandCenterHiringMetrics {
  const jobPostings = (input.job_postings ?? []).filter((signal) => signal.signal_type === "job_posting")
  const hireSignals = (input.hire_signals ?? []).filter((signal) => signal.signal_type === "hire")

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentJobCount = jobPostings.filter((signal) => Date.parse(signal.occurred_at) >= recentCutoff).length
  const recentHireCount = hireSignals.filter((signal) => Date.parse(signal.occurred_at) >= recentCutoff).length

  const top_hiring_companies = hireSignals
    .map((signal) => {
      const metrics = readHiringVelocityFromMetadata(signal.metadata)
      return {
        company_name: signal.company_name?.trim() || signal.domain?.trim() || "—",
        domain: signal.domain,
        open_role_count: metrics?.open_role_count ?? 0,
        hiring_spike: metrics?.hiring_spike ?? false,
      }
    })
    .sort((a, b) => b.open_role_count - a.open_role_count)
    .slice(0, 5)

  const hiring_spikes = hireSignals
    .map((signal) => {
      const metrics = readHiringVelocityFromMetadata(signal.metadata)
      if (!metrics?.hiring_spike) return null
      return {
        company_name: signal.company_name?.trim() || signal.domain?.trim() || "—",
        domain: signal.domain,
        hiring_velocity_7d: metrics.hiring_velocity_7d,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return {
    recent_hiring_signals_count: recentJobCount + recentHireCount,
    top_hiring_companies,
    hiring_spikes,
  }
}

/**
 * Milestone A stub extended — ranked feed remains lightweight.
 */
export function buildCommandCenterSignalFeed(
  signals: GrowthSignalRow[],
): { title: string; items: Array<{ id: string; label: string; score: number }> } {
  return {
    title: "Intent signals (foundation preview)",
    items: signals.slice(0, 5).map((signal) => ({
      id: signal.id,
      label: signal.evidence_summary || signal.company_name || signal.signal_type,
      score: signal.signal_score,
    })),
  }
}

export function formatCommandCenterHiringCompanyLabel(signal: GrowthSignalRow): string {
  const metrics = readHiringVelocityFromMetadata(signal.metadata)
  const company = signal.company_name?.trim() || signal.domain?.trim() || "—"
  if (!metrics) return company
  const departments = formatDepartmentDistribution(metrics.department_distribution, 2)
  return `${company} · ${metrics.open_role_count} roles · ${departments}`
}

export type CommandCenterWatchlistMetrics = {
  active_watchlists: number
  matches_last_24h: number
  top_watchlists: Array<{ id: string; name: string; match_count: number }>
  high_urgency_unmatched: number
}

/** Read-only Command Center watchlist metrics (Milestone D). */
export function buildCommandCenterWatchlistMetrics(
  snapshot: CommandCenterWatchlistMetrics,
): CommandCenterWatchlistMetrics {
  return {
    active_watchlists: snapshot.active_watchlists,
    matches_last_24h: snapshot.matches_last_24h,
    top_watchlists: snapshot.top_watchlists.slice(0, 5),
    high_urgency_unmatched: snapshot.high_urgency_unmatched,
  }
}

export type CommandCenterSignalMomentumCompany = {
  company_name: string
  domain: string | null
  momentum_score: number
  momentum_label: GrowthSignalMomentumLabel
  latest_signal_summary: string | null
  watchlist_match: boolean
}

export type CommandCenterSignalMomentumSummary = {
  qa_marker: typeof GROWTH_SIGNAL_MOMENTUM_QA_MARKER
  momentum_label: GrowthSignalMomentumLabel
  average_momentum_score: number
  high_urgency_signals_count: number
  news_events_count: number
  hiring_spikes_count: number
  watchlist_matches_last_24h: number
  watchlist_matches_last_7d: number
  top_companies_by_momentum: CommandCenterSignalMomentumCompany[]
}

function companyKey(signal: GrowthSignalRow): string {
  const domain = signal.domain?.trim().toLowerCase()
  if (domain) return `domain:${domain}`
  const name = signal.company_name?.trim().toLowerCase()
  if (name) return `company:${name}`
  return `signal:${signal.id}`
}

function countWatchlistMatchesSince(
  matches: Array<{ matched_at: string }> | undefined,
  hours: number,
  nowMs: number,
): number {
  const cutoff = nowMs - hours * 60 * 60 * 1000
  return (matches ?? []).filter((row) => Date.parse(row.matched_at) >= cutoff && Date.parse(row.matched_at) <= nowMs)
    .length
}

/** Milestone E — Intent Signals momentum summary for Command Center. */
export function buildCommandCenterSignalMomentumSummary(input: {
  signals: GrowthSignalRow[]
  watchlist_metrics?: CommandCenterWatchlistMetrics
  watchlist_matches?: Array<{ matched_at: string }>
  watchlist_match_signal_ids?: Set<string>
  now?: Date
}): CommandCenterSignalMomentumSummary {
  const nowMs = (input.now ?? new Date()).getTime()
  const activeSignals = input.signals.filter((signal) => signal.suppression_state === "active")
  const matchIds = input.watchlist_match_signal_ids ?? new Set<string>()

  const groups = new Map<string, GrowthSignalRow[]>()
  for (const signal of activeSignals) {
    const key = companyKey(signal)
    const bucket = groups.get(key) ?? []
    bucket.push(signal)
    groups.set(key, bucket)
  }

  const rollups: CommandCenterSignalMomentumCompany[] = []
  for (const bucket of groups.values()) {
    const primary = bucket[0]!
    const rollup = buildCompanySignalRollup({
      domain: primary.domain,
      company_id: primary.company_id,
      company_name: primary.company_name,
      signals: bucket,
    })
    if (rollup.total_signal_count === 0) continue
    rollups.push({
      company_name: primary.company_name?.trim() || primary.domain?.trim() || "—",
      domain: primary.domain,
      momentum_score: rollup.momentum_score,
      momentum_label: rollup.momentum_label,
      latest_signal_summary: rollup.latest_signal_summary,
      watchlist_match: bucket.some((signal) => matchIds.has(signal.id)),
    })
  }

  const avgMomentum =
    rollups.length > 0
      ? Math.round(rollups.reduce((sum, row) => sum + row.momentum_score, 0) / rollups.length)
      : 0

  const highUrgency = activeSignals.filter(
    (signal) => signal.urgency === "high" || signal.urgency === "urgent",
  ).length
  const newsEvents = activeSignals.filter((signal) => signal.signal_type === "news_event").length
  const hiringSpikes = activeSignals.filter((signal) => {
    if (signal.signal_type !== "hire") return false
    const velocity = signal.metadata?.hiring_velocity
    return velocity && typeof velocity === "object"
      ? (velocity as Record<string, unknown>).hiring_spike === true
      : false
  }).length

  return {
    qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    momentum_label: deriveMomentumLabel(avgMomentum),
    average_momentum_score: avgMomentum,
    high_urgency_signals_count: highUrgency,
    news_events_count: newsEvents,
    hiring_spikes_count: hiringSpikes,
    watchlist_matches_last_24h:
      input.watchlist_metrics?.matches_last_24h ??
      countWatchlistMatchesSince(input.watchlist_matches, 24, nowMs),
    watchlist_matches_last_7d: countWatchlistMatchesSince(input.watchlist_matches, 24 * 7, nowMs),
    top_companies_by_momentum: rollups
      .sort((a, b) => b.momentum_score - a.momentum_score)
      .slice(0, 5),
  }
}
