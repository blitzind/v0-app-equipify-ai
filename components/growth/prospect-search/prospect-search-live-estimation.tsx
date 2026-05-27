"use client"

import { Loader2, Users } from "lucide-react"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import {
  GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
  GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
  GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import { cn } from "@/lib/utils"

function stateLabel(state: string): string {
  switch (state) {
    case "estimating":
      return "Sizing market…"
    case "filters_too_restrictive":
      return "Filters may be too restrictive"
    case "provider_unavailable":
      return "External search unavailable"
    case "using_cached_estimate":
      return "Using cached market estimate"
    case "presearch_broad_market":
      return "Broad estimate"
    default:
      return ""
  }
}

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
  const stateText = stateLabel(displayState)
  const showSpinner = loading || displayState === "estimating"
  const headline = estimate?.display_label ?? stateText ?? "Sizing market…"
  const helper =
    estimate?.market_helper ??
    "Broad pre-search estimate — run Search for actual results and provider status."

  if (prominent) {
    return (
      <div
        className={cn(
          "w-full min-w-0 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-background px-4 py-3 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30",
          className,
        )}
        data-qa-marker={GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER}
        data-estimation-state-marker={GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER}
        data-search-preview-marker={GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER}
        data-presearch-vs-results-marker={estimate?.presearch_vs_results_qa_marker}
        data-market-estimation-tier-marker={estimate?.presearch_market_qa_marker}
        data-no-false-negative-estimates-marker={estimate?.no_false_negative_qa_marker}
        data-estimation-state={displayState}
        data-market-size-prominent="v1"
        data-estimation-phase="presearch"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
            {showSpinner ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Market estimate
            </p>
            <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {showSpinner && !estimate ? "Sizing your market…" : headline}
            </p>
            <p className="mt-1 text-xs text-muted-foreground break-words">{helper}</p>
            {estimate?.market_tier ? (
              <p className="mt-1 text-[11px] font-medium text-violet-900 dark:text-violet-200">
                Tier: {estimate.market_tier.replace(/_/g, " ")}
              </p>
            ) : null}
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
      data-estimation-state-marker={GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER}
      data-search-preview-marker={GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER}
      data-presearch-vs-results-marker={estimate?.presearch_vs_results_qa_marker}
      data-market-estimation-tier-marker={estimate?.presearch_market_qa_marker}
      data-no-false-negative-estimates-marker={estimate?.no_false_negative_qa_marker}
      data-estimation-state={displayState}
      data-estimation-phase="presearch"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showSpinner ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
        <span className="font-medium text-foreground">
          {showSpinner && !estimate ? "Sizing market…" : headline}
        </span>
      </div>
      {estimate ? (
        <p className={cn("mt-1 text-muted-foreground break-words", compact && "mt-0.5 line-clamp-3")}>
          {helper}
          {displayState === "using_cached_estimate" ? " · Using cached estimate" : null}
          {stateText && displayState !== "ready" && displayState !== "using_cached_estimate"
            ? ` · ${stateText}`
            : null}
        </p>
      ) : null}
    </div>
  )
}
