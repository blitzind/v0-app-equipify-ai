"use client"

import { Badge } from "@/components/ui/badge"
import { resolveProspectSearchPersonEngineChannelBadges } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-filters"
import {
  GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER,
  PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

function committeeRoleLabel(role: string): string {
  return (
    PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[role as GrowthBuyingCommitteeIntelligenceRole] ??
    role.replace(/_/g, " ")
  )
}

export function ProspectSearchEngineIntelligenceChannelBadges({
  row,
  className,
}: {
  row: GrowthProspectSearchPeopleResultRow
  className?: string
}) {
  const engine = row.company.contact_intelligence?.engine_intelligence
  if (!engine?.has_canonical_company) return null

  const badges = resolveProspectSearchPersonEngineChannelBadges(row)
  const any =
    badges.verified_email ||
    badges.verified_phone ||
    badges.verified_profile ||
    badges.committee_role

  if (!any) return null

  return (
    <div
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
      data-engine-channel-badges="v1"
    >
      {badges.verified_email ? (
        <Badge variant="default" className="text-[10px]">
          Verified email
        </Badge>
      ) : null}
      {badges.verified_phone ? (
        <Badge variant="default" className="text-[10px]">
          Verified phone
        </Badge>
      ) : null}
      {badges.verified_profile ? (
        <Badge variant="default" className="text-[10px]">
          Verified profile
        </Badge>
      ) : null}
      {badges.committee_role ? (
        <Badge variant="outline" className="text-[10px]">
          {committeeRoleLabel(badges.committee_role)}
        </Badge>
      ) : null}
    </div>
  )
}
