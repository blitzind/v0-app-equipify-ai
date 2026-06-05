"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-coverage-ux"

export function ProspectSearchCoverageBadges({
  coverage,
  compact = false,
  className,
}: {
  coverage: ProspectSearchIntelligenceCoverage | null | undefined
  compact?: boolean
  className?: string
}) {
  if (!coverage) return null

  const { company, metrics, unresolved_contact_count } = coverage

  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER}
      data-engine-coverage-badges="v1"
    >
      {company.unresolved_company ? (
        <Badge variant="outline" className={cn(compact ? "text-[10px]" : "text-xs", "border-amber-400 text-amber-950")}>
          Unresolved company
        </Badge>
      ) : (
        <Badge variant="outline" className={cn(compact ? "text-[10px]" : "text-xs", "border-emerald-400 text-emerald-950")}>
          Canonical company · {Math.round(company.confidence * 100)}%
        </Badge>
      )}
      {unresolved_contact_count > 0 ? (
        <Badge variant="outline" className={cn(compact ? "text-[10px]" : "text-xs", "border-amber-300 text-amber-900")}>
          {unresolved_contact_count} unresolved contact{unresolved_contact_count === 1 ? "" : "s"}
        </Badge>
      ) : metrics.contact_count > 0 ? (
        <Badge variant="secondary" className={compact ? "text-[10px]" : "text-xs"}>
          {metrics.canonical_person_coverage_pct}% person linkage
        </Badge>
      ) : null}
      {metrics.has_verified_company_intelligence ? (
        <Badge variant="outline" className={compact ? "text-[10px]" : "text-xs"}>
          Intel {metrics.intelligence_coverage_pct}%
        </Badge>
      ) : null}
    </div>
  )
}
