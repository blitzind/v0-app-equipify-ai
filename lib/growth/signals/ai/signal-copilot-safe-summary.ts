/** Deterministic Signal Copilot summaries — source of truth when AI is unavailable. */

import {
  buildCompanySignalRollup,
  formatSignalTypeLabel,
  type GrowthCompanySignalRollup,
} from "@/lib/growth/signals/company-signal-rollup"
import type { CommandCenterSignalMomentumSummary } from "@/lib/growth/signals/integrations/command-center-bridge"
import type { TerritorySignalIntelligenceSummary } from "@/lib/growth/signals/integrations/territory-signal-intelligence"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  buildSignalCopilotCompanyEvidencePacket,
  personSignalDisplayLabel,
} from "@/lib/growth/signals/ai/signal-copilot-context-builder"
import {
  GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
  SIGNAL_COPILOT_DISCLAIMER,
  emptySignalCopilotInsightBundle,
  narrativeConfidenceFromRollup,
  type SignalCopilotCommandBriefing,
  type SignalCopilotCompanyEvidencePacket,
  type SignalCopilotCompanyNarrative,
  type SignalCopilotInsightBundle,
  type SignalCopilotOperatorSuggestion,
  type SignalCopilotTerritorySummary,
  type SignalCopilotWatchlistSummary,
  type SignalCopilotWhyNowResult,
} from "@/lib/growth/signals/ai/signal-copilot-types"
import {
  sanitizeWhyNowResult,
  validateSignalCopilotNarrative,
  validateWhyNowBullets,
} from "@/lib/growth/signals/ai/signal-copilot-output-validator"

function formatDaysAgo(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const days = Math.max(0, Math.round((Date.now() - ms) / (24 * 60 * 60 * 1000)))
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

export function buildOperatorNextStepSuggestions(input: {
  rollup: GrowthCompanySignalRollup
  packet: SignalCopilotCompanyEvidencePacket
}): SignalCopilotOperatorSuggestion[] {
  const suggestions: SignalCopilotOperatorSuggestion[] = []

  if (input.rollup.hiring_signal_count > 0 || input.rollup.job_posting_count > 0) {
    suggestions.push({
      id: "review_hiring",
      label: "Review recent hiring activity.",
      rationale: "Verified hiring or job posting signals are present.",
      safe_action: true,
    })
  }
  if (input.rollup.news_count > 0) {
    suggestions.push({
      id: "review_news",
      label: "Review company news.",
      rationale: "A verified news signal is attached to this account.",
      safe_action: true,
    })
  }
  if (input.rollup.job_change_count > 0 || input.rollup.promotion_count > 0) {
    suggestions.push({
      id: "review_people_signals",
      label: "Monitor verified leadership or role changes.",
      rationale: "Person-level employment signals require human review.",
      safe_action: true,
    })
  }
  if (input.rollup.watchlist_match_count > 0) {
    suggestions.push({
      id: "review_watchlist",
      label: "Review watchlist match context.",
      rationale: "This account matched an operator-defined watchlist.",
      safe_action: true,
    })
  }
  if (input.rollup.momentum_score >= 56) {
    suggestions.push({
      id: "evaluate_territory",
      label: "Evaluate for territory outreach planning.",
      rationale: "Momentum score indicates elevated operational activity.",
      safe_action: true,
    })
  }
  if (suggestions.length === 0 && input.rollup.total_signal_count > 0) {
    suggestions.push({
      id: "monitor_signals",
      label: "Monitor for additional verified signal activity.",
      rationale: "Limited evidence available — continue observation.",
      safe_action: true,
    })
  }

  return suggestions.slice(0, 5)
}

export function buildWhyThisCompanyMattersNow(input: {
  rollup: GrowthCompanySignalRollup
  packet: SignalCopilotCompanyEvidencePacket
  signals?: GrowthSignalRow[]
}): SignalCopilotWhyNowResult | null {
  if (input.rollup.total_signal_count === 0) return null

  const bullets: string[] = []

  if (input.rollup.hiring_signal_count > 0 || input.rollup.job_posting_count > 0) {
    const dept = input.rollup.top_categories[0]
    bullets.push(
      dept
        ? `Hiring activity increased in ${dept} over the last 30 days.`
        : "Hiring or job posting activity increased over the last 30 days.",
    )
  }

  if (input.rollup.news_count > 0) {
    const news = input.packet.recent_signals.find((signal) => signal.type === "news_event")
    bullets.push(
      news
        ? `Recent news signal: ${news.summary.slice(0, 120)}.`
        : "A verified news event was recorded recently.",
    )
  }

  for (const watchlist of input.packet.watchlist_matches.slice(0, 2)) {
    bullets.push(`Matched watchlist: ${watchlist}.`)
  }

  if (input.rollup.job_change_count > 0 || input.rollup.promotion_count > 0) {
    const peopleSignal = (input.signals ?? []).find(
      (signal) => signal.signal_type === "job_change" || signal.signal_type === "promotion",
    )
    const person = peopleSignal ? personSignalDisplayLabel(peopleSignal) : null
    if (person && input.rollup.promotion_count > 0) {
      bullets.push(`Verified promotion signal for ${person}.`)
    } else if (person && input.rollup.job_change_count > 0) {
      bullets.push(`Verified job change signal for ${person}.`)
    } else {
      bullets.push("Verified person-level employment movement was recorded.")
    }
  }

  if (input.packet.territory_alignment) {
    bullets.push(`Territory alignment: ${input.packet.territory_alignment}.`)
  }

  if (bullets.length === 0 && input.rollup.latest_signal_summary) {
    bullets.push(`Latest verified signal: ${input.rollup.latest_signal_summary}.`)
  }

  const trimmed = bullets.slice(0, 4)
  const validation = validateWhyNowBullets(trimmed)
  if (!validation.ok) return null

  return sanitizeWhyNowResult({
    qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    bullets: trimmed,
    confidence: narrativeConfidenceFromRollup(input.rollup),
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  })
}

export function generateCompanySignalNarrative(input: {
  rollup: GrowthCompanySignalRollup
  packet: SignalCopilotCompanyEvidencePacket
}): SignalCopilotCompanyNarrative | null {
  if (input.rollup.total_signal_count === 0) return null

  const parts: string[] = []
  const reasoning: string[] = []

  if (input.rollup.hiring_signal_count > 0 || input.rollup.job_posting_count > 0) {
    const dept = input.rollup.top_categories[0] ?? "operations"
    parts.push(`elevated ${dept} hiring activity`)
    reasoning.push(`Hiring/job signals recorded (${input.rollup.hiring_signal_count + input.rollup.job_posting_count}).`)
  }
  if (input.rollup.news_count > 0) {
    parts.push("recent operational news activity")
    reasoning.push(`News signals recorded (${input.rollup.news_count}).`)
  }
  if (input.rollup.job_change_count + input.rollup.promotion_count > 0) {
    parts.push("verified leadership or role movement")
    reasoning.push(
      `People signals recorded (job changes: ${input.rollup.job_change_count}, promotions: ${input.rollup.promotion_count}).`,
    )
  }

  const activityText =
    parts.length > 0 ? parts.join(" and ") : "recent verified signal activity"

  const short_summary = `${input.packet.company} shows ${activityText} (${input.rollup.momentum_label} momentum).`

  const latestWhen = formatDaysAgo(input.rollup.latest_signal_at)
  const detailed_summary = `${input.packet.company} shows ${activityText}${
    latestWhen ? ` with the latest verified signal ${latestWhen}` : ""
  }. Momentum score ${input.rollup.momentum_score} is based on deterministic signal evidence — not inferred purchase intent.`

  if (input.packet.watchlist_matches.length > 0) {
    reasoning.push(`Watchlist matches: ${input.packet.watchlist_matches.join(", ")}.`)
  }

  for (const signal of input.packet.recent_signals.slice(0, 3)) {
    reasoning.push(`${formatSignalTypeLabel(signal.type)}: ${signal.summary.slice(0, 120)}.`)
  }

  const narrative: SignalCopilotCompanyNarrative = {
    qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    short_summary,
    detailed_summary,
    confidence: narrativeConfidenceFromRollup(input.rollup),
    reasoning_bullets: reasoning.slice(0, 5),
    suggested_operator_focus: buildOperatorNextStepSuggestions(input).map((row) => row.label),
    source: "deterministic",
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  }

  const validation = validateSignalCopilotNarrative(narrative)
  return validation.ok ? narrative : null
}

export function buildSignalCopilotInsightBundle(input: {
  domain?: string | null
  company_id?: string | null
  company_name?: string | null
  signals: GrowthSignalRow[]
  watchlist_matches?: Array<{ watchlist_id: string; watchlist_name: string; signal_id: string }>
  territory_alignment?: string | null
  now?: Date
}): SignalCopilotInsightBundle {
  const packet = buildSignalCopilotCompanyEvidencePacket(input)
  const rollup = buildCompanySignalRollup({
    domain: input.domain,
    company_id: input.company_id,
    company_name: input.company_name,
    signals: input.signals,
    watchlist_matches: input.watchlist_matches,
    now: input.now,
  })

  if (rollup.total_signal_count === 0) return emptySignalCopilotInsightBundle()

  return {
    narrative: generateCompanySignalNarrative({ rollup, packet }),
    why_now: buildWhyThisCompanyMattersNow({ rollup, packet, signals: input.signals }),
    operator_suggestions: buildOperatorNextStepSuggestions({ rollup, packet }),
  }
}

export function buildTerritorySignalCopilotSummary(input: {
  territory_label: string
  summary: TerritorySignalIntelligenceSummary
}): SignalCopilotTerritorySummary | null {
  if (input.summary.total_signals_30d === 0) return null

  const lines: string[] = []
  if (input.summary.hiring_spikes > 0) {
    lines.push(`${input.summary.hiring_spikes} hiring spike signal(s) in the last 30 days.`)
  }
  if (input.summary.news_events > 0) {
    lines.push(`${input.summary.news_events} news event(s) in the last 30 days.`)
  }
  if (input.summary.companies_with_signals > 0) {
    lines.push(`${input.summary.companies_with_signals} companies with verified signals.`)
  }

  const summary = `${input.territory_label} territory shows ${lines.join(" ")} Average momentum: ${input.summary.momentum_label}.`

  return {
    qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    summary: summary.slice(0, 400),
    top_momentum_companies: input.summary.top_signal_companies.map((row) => row.company_name).slice(0, 5),
    operational_shifts: lines.slice(0, 4),
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  }
}

export function buildWatchlistSignalCopilotSummary(input: {
  watchlist_name: string
  matched_signals: GrowthSignalRow[]
  top_companies: string[]
}): SignalCopilotWatchlistSummary | null {
  if (input.matched_signals.length === 0) return null

  const peopleHighlights = input.matched_signals
    .filter((signal) => signal.signal_type === "job_change" || signal.signal_type === "promotion")
    .map((signal) => {
      const person = personSignalDisplayLabel(signal)
      return person ? `${person} — ${formatSignalTypeLabel(signal.signal_type)}` : null
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 3)

  const recent = input.matched_signals
    .slice(0, 5)
    .map((signal) => `${signal.company_name ?? signal.domain ?? "Company"}: ${safeSignalLine(signal)}`)

  return {
    qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    watchlist_name: input.watchlist_name,
    summary: `${input.watchlist_name} recorded ${input.matched_signals.length} verified match(es) in the review window.`,
    top_companies: input.top_companies.slice(0, 5),
    recent_activity: recent,
    people_signal_highlights: peopleHighlights,
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  }
}

function safeSignalLine(signal: GrowthSignalRow): string {
  return signal.evidence_summary?.trim().slice(0, 100) || formatSignalTypeLabel(signal.signal_type)
}

export function buildCommandCenterAiSignalBriefing(input: {
  momentum: CommandCenterSignalMomentumSummary
  watchlist_names?: string[]
}): SignalCopilotCommandBriefing | null {
  const lines: string[] = []
  const urgent: string[] = []

  if (input.momentum.top_companies_by_momentum.length > 0) {
    lines.push(
      `${input.momentum.top_companies_by_momentum.length} companies show elevated signal momentum this period.`,
    )
  }
  if (input.momentum.hiring_spikes_count > 0) {
    lines.push(`${input.momentum.hiring_spikes_count} hiring spike signal(s) detected.`)
    urgent.push("Review accounts with hiring spike signals.")
  }
  if (input.momentum.job_changes_count > 0 || input.momentum.promotions_count > 0) {
    lines.push(
      `${input.momentum.job_changes_count} job change and ${input.momentum.promotions_count} promotion signal(s) require human review.`,
    )
    urgent.push("Review verified people signals before any outreach planning.")
  }
  if (input.momentum.watchlist_matches_last_7d > 0) {
    lines.push(`${input.momentum.watchlist_matches_last_7d} watchlist match(es) in the last 7 days.`)
  }

  if (lines.length === 0) return null

  return {
    qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
    title: "AI Signal Intelligence Briefing",
    summary_lines: lines.slice(0, 5),
    urgent_shifts: urgent.slice(0, 4),
    watchlist_highlights: (input.watchlist_names ?? []).slice(0, 5),
    high_priority_companies: input.momentum.top_companies_by_momentum
      .filter((row) => row.momentum_score >= 56)
      .map((row) => row.company_name)
      .slice(0, 5),
    disclaimer: SIGNAL_COPILOT_DISCLAIMER,
  }
}

export function sanitizeSignalCopilotInsightForClient<T extends Record<string, unknown>>(payload: T): T {
  const clone = { ...payload }
  delete clone.raw_payload
  delete clone.provider_debug
  delete clone.person_external_id
  return clone
}
