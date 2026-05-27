"use client"

import { Loader2, Users } from "lucide-react"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import {
  GROWTH_FILTER_ESTIMATION_STATE_QA_MARKER,
  GROWTH_LIVE_ESTIMATED_RESULTS_QA_MARKER,
  GROWTH_SEARCH_RESULT_PREVIEW_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import { formatProspectSearchMarketSizeHeadline } from "@/lib/growth/prospect-search/prospect-search-estimation-format"
import { cn } from "@/lib/utils"

function stateLabel(state: string): string {
  switch (state) {
    case "estimating":
      return "Sizing market…"
    case "no_likely_matches":
      return "No likely matches"
    case "filters_too_restrictive":
      return "Filters may be too restrictive"
    case "provider_unavailable":
      return "External search unavailable"
    case "using_cached_estimate":
      return "Using cached market estimate"
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
  const marketCopy =
    estimate != null
      ? formatProspectSearchMarketSizeHeadline({
          exact_count: estimate.exact_count,
          confidence: estimate.confidence,
          discovery_mode: estimate.discovery_mode,
        })
      : null

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
        data-estimation-state={displayState}
        data-market-size-prominent="v1"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
            {showSpinner ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {estimate?.discovery_mode === "discover_external" ? "Estimated market" : "Matching companies"}
            </p>
            <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {showSpinner && !estimate
                ? "Sizing your market…"
                : marketCopy?.headline ?? stateText ?? "Adjust filters to preview market size"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground break-words">
              {marketCopy?.helper ??
                (estimate?.discovery_mode === "discover_external"
                  ? "External search has not run yet — counts use your index and ICP filters."
                  : "Counts update as you change filters — no search required.")}
            </p>
            {estimate && estimate.discovery_mode === "discover_external" ? (
              <p className="mt-1 text-[11px] font-medium text-violet-900 dark:text-violet-200">
                External discovery not yet executed — click Search when ready.
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
      data-estimation-state={displayState}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showSpinner ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
        <span className="font-medium text-foreground">
          {showSpinner && !estimate ? "Sizing market…" : marketCopy?.headline ?? estimate?.display_label ?? stateText}
        </span>
      </div>
      {marketCopy || estimate ? (
        <p className={cn("mt-1 text-muted-foreground break-words", compact && "mt-0.5 line-clamp-3")}>
          {marketCopy?.helper ?? estimate?.provider_readiness.label}
          {displayState === "using_cached_estimate" ? " · Using cached estimate" : null}
          {stateText && displayState !== "ready" && displayState !== "using_cached_estimate"
            ? ` · ${stateText}`
            : null}
        </p>
      ) : null}
    </div>
  )
}
