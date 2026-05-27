/** AI Signal Copilot types — evidence-backed summaries only (Milestone G). Client-safe. */

import type { GrowthCompanySignalRollup, GrowthSignalMomentumLabel } from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthSignalType } from "@/lib/growth/signals/signal-types"

export const GROWTH_SIGNAL_COPILOT_QA_MARKER = "growth-signal-copilot-v1" as const

export const GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER = "growth-signal-ai-insights-v1" as const

export const SIGNAL_COPILOT_DISCLAIMER =
  "AI summaries are generated from verified signal evidence and should be reviewed by your team." as const

export type SignalCopilotEvidenceSignal = {
  signal_id: string
  type: GrowthSignalType
  summary: string
  score: number
  occurred_at: string | null
  category: string | null
  urgency: string | null
}

export type SignalCopilotCompanyEvidencePacket = {
  qa_marker: typeof GROWTH_SIGNAL_COPILOT_QA_MARKER
  company: string
  domain: string | null
  momentum_label: GrowthSignalMomentumLabel
  momentum_score: number
  recent_signals: SignalCopilotEvidenceSignal[]
  watchlist_matches: string[]
  territory_alignment: string | null
  signal_counts: {
    news: number
    jobs: number
    hiring: number
    job_changes: number
    promotions: number
  }
}

export type SignalCopilotCompanyNarrative = {
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  short_summary: string
  detailed_summary: string
  confidence: "low" | "medium" | "high"
  reasoning_bullets: string[]
  suggested_operator_focus: string[]
  source: "deterministic" | "ai_validated"
  disclaimer: typeof SIGNAL_COPILOT_DISCLAIMER
}

export type SignalCopilotWhyNowResult = {
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  bullets: string[]
  confidence: "low" | "medium" | "high"
  disclaimer: typeof SIGNAL_COPILOT_DISCLAIMER
}

export type SignalCopilotOperatorSuggestion = {
  id: string
  label: string
  rationale: string
  safe_action: true
}

export type SignalCopilotTerritorySummary = {
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  summary: string
  top_momentum_companies: string[]
  operational_shifts: string[]
  disclaimer: typeof SIGNAL_COPILOT_DISCLAIMER
}

export type SignalCopilotWatchlistSummary = {
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  watchlist_name: string
  summary: string
  top_companies: string[]
  recent_activity: string[]
  people_signal_highlights: string[]
  disclaimer: typeof SIGNAL_COPILOT_DISCLAIMER
}

export type SignalCopilotCommandBriefing = {
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  title: string
  summary_lines: string[]
  urgent_shifts: string[]
  watchlist_highlights: string[]
  high_priority_companies: string[]
  disclaimer: typeof SIGNAL_COPILOT_DISCLAIMER
}

export type SignalCopilotInsightBundle = {
  narrative: SignalCopilotCompanyNarrative | null
  why_now: SignalCopilotWhyNowResult | null
  operator_suggestions: SignalCopilotOperatorSuggestion[]
}

export type SignalCopilotAiModelOutput = {
  short_summary: string
  detailed_summary: string
  reasoning_bullets: string[]
  suggested_operator_focus: string[]
  confidence: "low" | "medium" | "high"
}

export type SignalCopilotValidationResult = {
  ok: boolean
  errors: string[]
  sanitized?: SignalCopilotAiModelOutput
}

export function emptySignalCopilotInsightBundle(): SignalCopilotInsightBundle {
  return {
    narrative: null,
    why_now: null,
    operator_suggestions: [],
  }
}

export function narrativeConfidenceFromRollup(rollup: GrowthCompanySignalRollup): "low" | "medium" | "high" {
  if (rollup.evidence_count >= 2 && rollup.counts_30d >= 2) return "high"
  if (rollup.evidence_count >= 1 || rollup.total_signal_count >= 1) return "medium"
  return "low"
}
