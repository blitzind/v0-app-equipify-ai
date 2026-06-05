"use client"

import { Building2, ShieldCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProspectSearchEngineIntelligenceDiscoveryBadge } from "@/components/growth/prospect-search/prospect-search-engine-intelligence-discovery-badge"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import {
  GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER,
  PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS,
  PROSPECT_SEARCH_ENGINE_INTELLIGENCE_PANEL_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { ProspectSearchActionableResearchActions } from "@/components/growth/prospect-search/prospect-search-actionable-research-actions"
import { ProspectSearchEngineDiscoveryRollup } from "@/components/growth/prospect-search/prospect-search-engine-discovery-rollup"
import { ProspectSearchEngineReadinessSummaryCard } from "@/components/growth/prospect-search/prospect-search-engine-readiness-summary-card"
import { ProspectSearchEngineReadinessBreakdownPanel } from "@/components/growth/prospect-search/prospect-search-engine-readiness-breakdown-panel"
import { ProspectSearchCoverageResolutionPanel } from "@/components/growth/prospect-search/prospect-search-coverage-resolution-panel"
import { ProspectSearchSchemaHealthNotice } from "@/components/growth/prospect-search/prospect-search-schema-health-notice"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchEngineIntelligencePanel({
  companyName,
  intelligence,
  company,
  onResearchComplete,
}: {
  companyName: string
  intelligence: GrowthProspectSearchEngineIntelligence | null | undefined
  company?: GrowthProspectSearchCompanyResult | null
  onResearchComplete?: (message: string, ok: boolean) => void
}) {
  if (!intelligence?.has_canonical_company) return null

  const companyIntel = intelligence.company_intelligence
  const committee = intelligence.buying_committee
  const channels = intelligence.verified_channels

  return (
    <section
      className="mt-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER}
      data-intelligence-ux-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Building2 className="size-4 text-sky-800" />
        <h4 className="text-sm font-semibold text-sky-950">
          {PROSPECT_SEARCH_ENGINE_INTELLIGENCE_PANEL_TITLE} — {companyName}
        </h4>
        <Badge variant="outline" className="text-[10px]">
          Canonical company linked
        </Badge>
        <ProspectSearchEngineIntelligenceDiscoveryBadge
          status={companyIntel?.discovery_status}
          hasVerified={companyIntel?.has_verified_intelligence}
        />
      </div>

      <ProspectSearchSchemaHealthNotice health={intelligence.schema_health} />

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-sky-900">
        {companyIntel?.has_verified_intelligence ? (
          <Badge className="bg-sky-700 text-white hover:bg-sky-700">
            <ShieldCheck className="mr-1 size-3" />
            Verified company intelligence ({companyIntel.categories_present.length} categories)
          </Badge>
        ) : null}
        {committee?.verified_member_count ? (
          <Badge variant="outline">
            <Users className="mr-1 size-3" />
            Buying committee {committee.verified_member_count} verified · coverage{" "}
            {Math.round(committee.coverage_score * 100)}%
          </Badge>
        ) : null}
        {channels?.persons_with_verified_email ? (
          <Badge variant="outline">{channels.persons_with_verified_email} verified emails</Badge>
        ) : null}
        {channels?.persons_with_verified_phone ? (
          <Badge variant="outline">{channels.persons_with_verified_phone} verified phones</Badge>
        ) : null}
        {channels?.persons_with_verified_profile ? (
          <Badge variant="outline">{channels.persons_with_verified_profile} verified profiles</Badge>
        ) : null}
      </div>

      {companyIntel?.snapshots?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-sky-900">
          {companyIntel.snapshots.slice(0, 6).map((snapshot) => (
            <li key={`${snapshot.intelligence_category}:${snapshot.intelligence_key}`}>
              <span className="font-medium">{snapshot.intelligence_category}</span>
              {snapshot.value_text ? ` — ${snapshot.value_text}` : ` · ${snapshot.intelligence_key}`}
            </li>
          ))}
        </ul>
      ) : null}

      {committee?.members?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-sky-900">
          {committee.members.slice(0, 6).map((member) => (
            <li key={`${member.person_id}:${member.committee_role}`}>
              {member.full_name}
              {member.job_title ? ` · ${member.job_title}` : ""} —{" "}
              {PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[
                member.committee_role as GrowthBuyingCommitteeIntelligenceRole
              ] ?? String(member.committee_role).replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ) : null}

      {company?.contact_intelligence?.engine_coverage ? (
        <ProspectSearchCoverageResolutionPanel
          coverage={company.contact_intelligence.engine_coverage}
          companyName={companyName}
        />
      ) : null}

      {company?.contact_intelligence?.engine_readiness ? (
        <div className="mt-3">
          <ProspectSearchEngineReadinessSummaryCard readiness={company.contact_intelligence.engine_readiness} />
          <ProspectSearchEngineReadinessBreakdownPanel
            readiness={company.contact_intelligence.engine_readiness}
            companyName={companyName}
          />
        </div>
      ) : null}

      {company ? (
        <>
          <ProspectSearchEngineDiscoveryRollup row={company} className="mt-3" />
          <ProspectSearchActionableResearchActions
            company={company}
            onComplete={onResearchComplete}
          />
        </>
      ) : null}
    </section>
  )
}
