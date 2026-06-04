"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import {
  formatProspectSearchPrioritizationTier,
  formatProspectSearchResearchCompleteness,
  GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER,
  PROSPECT_SEARCH_PRIORITIZATION_TIER_TONES,
  PROSPECT_SEARCH_RESEARCH_COMPLETENESS_TONES,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-ux"

export function ProspectSearchEngineReadinessBadges({
  readiness,
  compact = false,
  className,
}: {
  readiness: GrowthProspectSearchEngineReadiness | null | undefined
  compact?: boolean
  className?: string
}) {
  if (!readiness) return null

  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER}
      data-engine-readiness-badges="v1"
    >
      <Badge
        variant="outline"
        className={cn(
          compact ? "text-[10px]" : "text-xs",
          PROSPECT_SEARCH_PRIORITIZATION_TIER_TONES[readiness.prioritization_tier],
        )}
        title={readiness.operator_summary}
      >
        {formatProspectSearchPrioritizationTier(readiness.prioritization_tier)}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          compact ? "text-[10px]" : "text-xs",
          PROSPECT_SEARCH_RESEARCH_COMPLETENESS_TONES[readiness.research_completeness],
        )}
      >
        {formatProspectSearchResearchCompleteness(readiness.research_completeness)}
      </Badge>
      {!compact ? (
        <Badge variant="secondary" className="text-xs">
          Readiness {readiness.overall.score}/100
        </Badge>
      ) : null}
    </div>
  )
}
