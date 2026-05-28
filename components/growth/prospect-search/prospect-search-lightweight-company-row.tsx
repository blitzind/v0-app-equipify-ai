"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_MASSIVE_MARKET_INDEX_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-massive-market-index"
import { GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-progressive-enrichment"
import { GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"

function formatContactabilityLabel(label: string | null | undefined): string {
  if (!label) return "Unknown"
  return label.replace(/_/g, " ")
}

export function ProspectSearchLightweightCompanyRow({
  company,
  onFindContacts,
}: {
  company: GrowthProspectSearchCompanyResult
  onFindContacts?: (company: GrowthProspectSearchCompanyResult) => void
}) {
  const reachable = company.reachable_human
  const label = company.contactability_status ?? reachable?.label ?? "no_reachable_humans"

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
      data-lightweight-company-mode="v1"
      data-massive-market-index-marker={GROWTH_MASSIVE_MARKET_INDEX_QA_MARKER}
      data-contact-first-discovery-marker={GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER}
      data-progressive-company-overlay-marker={GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER}
      data-reachable-human-priority-marker={GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{company.company_name}</p>
          <p className="text-muted-foreground">
            {[company.website, company.location, company.industry].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{formatContactabilityLabel(label)}</Badge>
          {reachable ? (
            <Badge variant="secondary">Reachable score {reachable.score}</Badge>
          ) : null}
        </div>
      </div>
      {reachable?.risks?.[0] ? (
        <p className="mt-2 text-amber-900">{reachable.risks[0]}</p>
      ) : null}
      {onFindContacts && label === "no_reachable_humans" ? (
        <button
          type="button"
          className="mt-2 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline"
          onClick={() => onFindContacts(company)}
        >
          Run contact acquisition
        </button>
      ) : null}
    </div>
  )
}
