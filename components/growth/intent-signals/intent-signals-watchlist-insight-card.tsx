"use client"

import { GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER, SIGNAL_COPILOT_DISCLAIMER } from "@/lib/growth/signals/ai/signal-copilot-types"
import type { SignalCopilotWatchlistSummary } from "@/lib/growth/signals/ai/signal-copilot-types"
import { cn } from "@/lib/utils"

export function WatchlistIntelligenceInsightCard({
  summary,
  className,
}: {
  summary: SignalCopilotWatchlistSummary | null
  className?: string
}) {
  if (!summary) return null

  return (
    <div
      className={cn("rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs", className)}
      data-qa-marker={GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER}
    >
      <p className="font-semibold text-foreground">Recent intelligence · {summary.watchlist_name}</p>
      <p className="mt-1 text-muted-foreground">{summary.summary}</p>
      {summary.top_companies.length > 0 ? (
        <p className="mt-2 text-[11px] text-foreground/90">
          Most active accounts: {summary.top_companies.join(", ")}
        </p>
      ) : null}
      {summary.people_signal_highlights.length > 0 ? (
        <p className="mt-1 text-[11px] text-foreground/90">
          New leadership movement: {summary.people_signal_highlights.join(" · ")}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] text-muted-foreground">{SIGNAL_COPILOT_DISCLAIMER}</p>
    </div>
  )
}
