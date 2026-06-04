"use client"

import { Badge } from "@/components/ui/badge"
import {
  formatProspectSearchEngineDiscoveryStatus,
  GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER,
  prospectSearchEngineDiscoveryBadgeVariant,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"

export function ProspectSearchEngineIntelligenceDiscoveryBadge({
  status,
  hasVerified,
  className,
}: {
  status: string | null | undefined
  hasVerified?: boolean
  className?: string
}) {
  if (hasVerified) {
    return (
      <Badge
        className={className}
        data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
        variant="default"
      >
        Verified intelligence
      </Badge>
    )
  }

  const label = formatProspectSearchEngineDiscoveryStatus(status)
  return (
    <Badge
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
      variant={prospectSearchEngineDiscoveryBadgeVariant(status)}
    >
      {label}
    </Badge>
  )
}
