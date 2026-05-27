/** Client-safe Signal Copilot surface types (no server-only imports). */

export const GROWTH_SIGNAL_COPILOT_QA_MARKER = "growth-signal-copilot-v1" as const

export const GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER = "growth-signal-ai-insights-v1" as const

export type GrowthSignalAiInsightsConfidence = "low" | "medium" | "high"

export const SIGNAL_COPILOT_CLIENT_DISCLAIMER =
  "AI summaries are generated from verified signal evidence and should be reviewed by your team." as const

export type GrowthSignalAiInsightClientFields = {
  signal_ai_short_summary?: string | null
  signal_ai_narrative_summary?: string | null
  signal_ai_confidence?: GrowthSignalAiInsightsConfidence | null
  signal_ai_reasoning_bullets?: string[]
  signal_why_now_bullets?: string[]
  signal_ai_operator_suggestions?: string[]
  signal_copilot_qa_marker?: typeof GROWTH_SIGNAL_COPILOT_QA_MARKER | null
  signal_ai_insights_qa_marker?: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER | null
}

export type GrowthSignalCopilotCommandBriefingClient = {
  title: string
  summary_lines: string[]
  urgent_shifts: string[]
  watchlist_highlights: string[]
  high_priority_companies: string[]
  disclaimer: typeof SIGNAL_COPILOT_CLIENT_DISCLAIMER
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
}

export type GrowthTerritorySignalCopilotSummaryClient = {
  summary: string
  top_momentum_companies: string[]
  operational_shifts: string[]
  qa_marker: typeof GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER
  disclaimer: typeof SIGNAL_COPILOT_CLIENT_DISCLAIMER
}
