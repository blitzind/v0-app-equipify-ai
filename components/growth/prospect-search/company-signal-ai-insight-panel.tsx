"use client"

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { SignalExplanationCard } from "@/components/growth/signals/signal-explanation-card"
import { GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER, SIGNAL_COPILOT_CLIENT_DISCLAIMER } from "@/lib/growth/signals/ai/signal-copilot-client-types"
import { cn } from "@/lib/utils"

export function CompanySignalAiInsightPanel({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const hasInsight =
    row.signal_ai_short_summary ||
    (row.signal_why_now_bullets?.length ?? 0) > 0 ||
    row.signal_ai_narrative_summary

  if (!hasInsight) return null

  const narrative =
    row.signal_ai_short_summary || row.signal_ai_narrative_summary
      ? {
          qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
          short_summary: row.signal_ai_short_summary ?? row.signal_ai_narrative_summary ?? "",
          detailed_summary: row.signal_ai_narrative_summary ?? row.signal_ai_short_summary ?? "",
          confidence: row.signal_ai_confidence ?? "medium",
          reasoning_bullets: row.signal_ai_reasoning_bullets ?? [],
          suggested_operator_focus: row.signal_ai_operator_suggestions ?? [],
          source: "deterministic" as const,
          disclaimer: SIGNAL_COPILOT_CLIENT_DISCLAIMER,
        }
      : null

  const whyNow =
    (row.signal_why_now_bullets?.length ?? 0) > 0
      ? {
          qa_marker: GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
          bullets: row.signal_why_now_bullets ?? [],
          confidence: row.signal_ai_confidence ?? "medium",
          disclaimer: SIGNAL_COPILOT_CLIENT_DISCLAIMER,
        }
      : null

  const suggestions = (row.signal_ai_operator_suggestions ?? []).map((label, index) => ({
    id: `suggestion-${index}`,
    label,
    rationale: "Evidence-linked operator suggestion.",
    safe_action: true as const,
  }))

  return (
    <details className={cn("mt-2", className)} data-qa-marker={GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER}>
      <summary className="cursor-pointer text-[11px] font-medium text-violet-800">AI Insight</summary>
      <SignalExplanationCard
        className="mt-2"
        companyName={row.company_name}
        momentumLabel={row.signal_momentum_label}
        narrative={narrative}
        whyNow={whyNow}
        operatorSuggestions={suggestions}
        watchlistMatches={(row.watchlist_matches ?? []).map((match) => match.watchlist_name)}
        topSignalSummaries={
          row.latest_signal_summary ? [row.latest_signal_summary] : undefined
        }
      />
    </details>
  )
}
