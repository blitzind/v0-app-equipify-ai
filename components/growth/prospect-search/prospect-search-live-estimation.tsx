"use client"

import { Loader2, Users } from "lucide-react"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import {
  GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER,
  GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER,
  GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER,
  GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
  GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
  GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import { PROSPECT_SEARCH_NO_CREDITS_ESTIMATE_NOTE } from "@/lib/growth/prospect-search/prospect-search-estimation-format"
import { cn } from "@/lib/utils"

export function ProspectSearchLiveEstimation({
  estimate,
  loading,
  displayState,
  compact = false,
  prominent = false,
  className,
}: {
  estimate: GrowthProspectSearchLiveEstimate | null
  loading: boolean
  displayState: string
  compact?: boolean
  prominent?: boolean
  className?: string
}) {
  const showSpinner = loading || displayState === "estimating"

  if (!showSpinner && !estimate) {
    return null
  }

  const headline =
    estimate?.numerical_headline ??
    estimate?.display_label ??
    (showSpinner ? "Sizing market…" : "")

  if (prominent) {
    return (
      <div
        className={cn(
          "w-full min-w-0 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-background px-4 py-3 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30",
          className,
        )}
        data-qa-marker={GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER}
        data-qa={GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER}
        data-estimation-state-marker={GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER}
        data-search-preview-marker={GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER}
        data-no-credits-estimate-qa={GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER}
        data-estimate-hidden-stale-qa={GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER}
        data-estimation-state={displayState}
        data-estimation-phase="presearch"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
            {showSpinner ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {headline}
            </p>
            {estimate?.market_helper ? (
              <p className="text-xs text-muted-foreground">{estimate.market_helper}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{PROSPECT_SEARCH_NO_CREDITS_ESTIMATE_NOTE}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs",
        compact && "px-2 py-1.5 text-[11px] leading-snug",
        className,
      )}
      data-qa-marker={GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER}
      data-qa={GROWTH_DISCOVER_LIVE_ESTIMATE_QA_MARKER}
      data-estimation-state-marker={GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER}
      data-search-preview-marker={GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER}
      data-no-credits-estimate-qa={GROWTH_DISCOVER_NO_CREDITS_ESTIMATE_QA_MARKER}
      data-estimate-hidden-stale-qa={GROWTH_DISCOVER_ESTIMATE_HIDDEN_WHEN_STALE_QA_MARKER}
      data-estimation-state={displayState}
      data-estimation-phase="presearch"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showSpinner ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
        <span className="font-medium text-foreground">{headline}</span>
      </div>
      {estimate?.market_helper ? (
        <p className={cn("mt-1 text-muted-foreground break-words", compact && "mt-0.5 line-clamp-2")}>
          {estimate.market_helper}
        </p>
      ) : null}
    </div>
  )
}
