"use client"

import { Loader2 } from "lucide-react"
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
      return "Estimating…"
    case "no_likely_matches":
      return "No likely matches"
    case "filters_too_restrictive":
      return "Filters too restrictive"
    case "provider_unavailable":
      return "Provider unavailable"
    case "using_cached_estimate":
      return "Using cached estimate"
    default:
      return ""
  }
}

function confidenceLabel(confidence: GrowthProspectSearchLiveEstimate["confidence"]): string | null {
  if (confidence === "low") return "Low confidence estimate"
  if (confidence === "medium") return "Medium confidence estimate"
  return null
}

export function ProspectSearchLiveEstimation({
  estimate,
  loading,
  displayState,
  compact = false,
  className,
}: {
  estimate: GrowthProspectSearchLiveEstimate | null
  loading: boolean
  displayState: string
  compact?: boolean
  className?: string
}) {
  const stateText = stateLabel(displayState)
  const showSpinner = loading || displayState === "estimating"

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs",
        compact && "px-2 py-1.5",
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
          {showSpinner && !estimate ? "Estimating…" : estimate?.display_label ?? stateText}
        </span>
        {estimate && confidenceLabel(estimate.confidence) ? (
          <span className="text-muted-foreground">{confidenceLabel(estimate.confidence)}</span>
        ) : null}
      </div>
      {estimate ? (
        <p className="mt-1 text-muted-foreground">
          {estimate.provider_readiness.label}
          {displayState === "using_cached_estimate" ? " · Using cached estimate" : null}
          {stateText && displayState !== "ready" && displayState !== "using_cached_estimate"
            ? ` · ${stateText}`
            : null}
        </p>
      ) : null}
    </div>
  )
}
