"use client"

import { Badge } from "@/components/ui/badge"
import {
  GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER,
  GROWTH_SIGNAL_COPILOT_QA_MARKER,
  SIGNAL_COPILOT_CLIENT_DISCLAIMER,
  type GrowthSignalAiInsightsConfidence,
} from "@/lib/growth/signals/ai/signal-copilot-client-types"
import type {
  SignalCopilotCompanyNarrative,
  SignalCopilotInsightBundle,
  SignalCopilotWhyNowResult,
} from "@/lib/growth/signals/ai/signal-copilot-types"
import type { GrowthSignalMomentumLabel } from "@/lib/growth/signals/company-signal-rollup"
import { cn } from "@/lib/utils"

export function SignalExplanationCard({
  companyName,
  momentumLabel,
  narrative,
  whyNow,
  operatorSuggestions,
  watchlistMatches,
  topSignalSummaries,
  className,
}: {
  companyName: string
  momentumLabel?: GrowthSignalMomentumLabel | null
  narrative?: SignalCopilotCompanyNarrative | null
  whyNow?: SignalCopilotWhyNowResult | null
  operatorSuggestions?: SignalCopilotInsightBundle["operator_suggestions"]
  watchlistMatches?: string[]
  topSignalSummaries?: string[]
  className?: string
}) {
  if (!narrative && !whyNow) return null

  return (
    <div
      className={cn("w-full min-w-0 rounded-lg border border-border/70 bg-card px-3 py-2.5", className)}
      data-qa-marker={GROWTH_SIGNAL_AI_INSIGHTS_QA_MARKER}
      data-copilot-marker={GROWTH_SIGNAL_COPILOT_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-foreground">Signal intelligence</p>
        {momentumLabel ? (
          <Badge variant="outline" className="text-[10px]">
            {momentumLabel}
          </Badge>
        ) : null}
        {narrative?.confidence ? (
          <Badge variant="secondary" className="text-[10px] capitalize">
            {narrative.confidence} confidence
          </Badge>
        ) : null}
      </div>

      {narrative?.short_summary ? (
        <p className="mt-2 text-xs text-foreground/90">{narrative.short_summary}</p>
      ) : null}

      {whyNow && whyNow.bullets.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Why this company matters now</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-foreground/90">
            {whyNow.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {topSignalSummaries && topSignalSummaries.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Top contributing signals</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {topSignalSummaries.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {watchlistMatches && watchlistMatches.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Watchlist matches: {watchlistMatches.join(", ")}
        </p>
      ) : null}

      {operatorSuggestions && operatorSuggestions.length > 0 ? (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Suggested next steps (human review)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-foreground/90">
            {operatorSuggestions.slice(0, 4).map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] text-muted-foreground">{SIGNAL_COPILOT_CLIENT_DISCLAIMER}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">Generated from verified signal evidence for {companyName}.</p>
    </div>
  )
}
