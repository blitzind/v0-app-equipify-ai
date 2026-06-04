"use client"

import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProspectSearchEngineIntelligenceDiscoveryBadge } from "@/components/growth/prospect-search/prospect-search-engine-intelligence-discovery-badge"
import { buildProspectSearchEngineIntelligenceSummary } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-filters"
import { GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchEngineIntelligenceSummary({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const summary = buildProspectSearchEngineIntelligenceSummary(row)
  if (!summary) return null

  return (
    <div
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
      data-engine-intelligence-summary="v1"
    >
      <p className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-950">
        <span className="inline-flex items-center gap-1 font-semibold">
          <ShieldCheck className="size-3.5" />
          {summary.headline}
        </span>
        {summary.detail ? <span className="mt-1 block text-sky-800">{summary.detail}</span> : null}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <ProspectSearchEngineIntelligenceDiscoveryBadge
          status={summary.discovery_status_label}
          hasVerified={summary.has_verified_company_intelligence}
        />
        {summary.verified_email_count > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {summary.verified_email_count} verified email
            {summary.verified_email_count === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {summary.verified_phone_count > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {summary.verified_phone_count} verified phone
            {summary.verified_phone_count === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {summary.verified_profile_count > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {summary.verified_profile_count} verified profile
            {summary.verified_profile_count === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {summary.committee_verified_count > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {summary.committee_verified_count} committee member
            {summary.committee_verified_count === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
