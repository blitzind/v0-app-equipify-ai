import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildRealWorldDiscoveryQuery,
  prospectSearchFiltersToRealWorldInputs,
} from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { runRealWorldCompanyDiscovery } from "@/lib/growth/real-world-discovery/real-world-discovery-repository"
import { attachCompanySignalSummaryToProspectCompany } from "@/lib/growth/company-signals/integrations/prospect-search-bridge"
import { runCompanySignalIntelligence } from "@/lib/growth/company-signals/company-signal-repository"
import {
  GROWTH_REAL_WORLD_SOURCE_BADGE_LABELS,
  type GrowthRealWorldCompanyCandidate,
  type GrowthRealWorldProviderStatusSummary,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

function buildExternalDiscoveryKeywords(row: GrowthRealWorldCompanyCandidate): string[] {
  const keywords: string[] = []
  if (row.category) keywords.push(row.category)
  if (row.description) keywords.push(row.description)
  if (row.industry) keywords.push(row.industry)
  for (const ev of row.evidence.slice(0, 3)) {
    if (ev.evidence) keywords.push(ev.evidence)
  }
  return keywords
}

function realWorldCandidateToCompanyResult(
  row: GrowthRealWorldCompanyCandidate & { rank_score?: number },
  rank_score: number,
  filterIndustry?: string | null,
): GrowthProspectSearchCompanyResult {
  const signals: string[] = []
  if (row.existing_customer_match) signals.push("Existing CRM customer match")
  if (row.existing_prospect_match) signals.push("Existing CRM prospect match")
  if (row.existing_growth_lead_match) signals.push("Existing Growth lead match")
  if (row.metadata.existing_lead_inbox_match) signals.push("Existing Lead Inbox match")
  if (row.rating != null) signals.push(`Rating ${row.rating}`)
  if (row.category) signals.push(row.category)
  for (const ev of row.evidence.slice(0, 2)) {
    signals.push(ev.evidence)
  }

  const badge =
    GROWTH_REAL_WORLD_SOURCE_BADGE_LABELS[row.provider_type] ?? row.provider_type

  const match_reasoning = [
    `Discovered via ${badge} (${row.provider_name}) — not an automatic lead.`,
    ...row.source_attribution.slice(0, 2).map((a) => a.evidence),
  ]

  const locationParts = [row.city, row.state, row.country].filter(Boolean)
  const locationLabel =
    row.location ??
    (locationParts.length ? locationParts.join(", ") : null)

  const keywords = buildExternalDiscoveryKeywords(row)
  const industry = row.industry ?? filterIndustry ?? null

  return {
    id: row.id,
    source_type: "external_discovered",
    company_name: row.company_name,
    website: row.website,
    industry,
    subindustry: row.category,
    city: row.city,
    state: row.state,
    country: row.country,
    employees: null,
    revenue_range: null,
    location: locationLabel,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: row.confidence,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals,
    search_intent_category: null,
    lead_inbox_id:
      typeof row.metadata.matched_lead_inbox_id === "string"
        ? row.metadata.matched_lead_inbox_id
        : null,
    growth_lead_id:
      typeof row.metadata.matched_growth_lead_id === "string"
        ? row.metadata.matched_growth_lead_id
        : null,
    prospect_id:
      typeof row.metadata.matched_prospect_id === "string"
        ? row.metadata.matched_prospect_id
        : null,
    customer_id:
      typeof row.metadata.matched_customer_id === "string"
        ? row.metadata.matched_customer_id
        : null,
    rank_score,
    match_reasoning,
    discovery_provider_type: row.provider_type,
    discovery_provider_name: row.provider_name,
    discovery_source_badge: badge,
    keywords,
    notes: row.description,
  }
}

export async function runProspectSearchRealWorldDiscovery(
  admin: SupabaseClient,
  input: {
    query: string
    filters: GrowthProspectSearchFilters
    created_by?: string | null
    limit?: number
  },
): Promise<{
  companies: GrowthProspectSearchCompanyResult[]
  discovery_run_id: string | null
  provider_messages: string[]
  provider_status: GrowthRealWorldProviderStatusSummary | null
  schema_ready: boolean
  built_query: string
  persist_warning?: string | null
}> {
  const search_inputs = prospectSearchFiltersToRealWorldInputs(input.filters, input.query)
  const built_query = buildRealWorldDiscoveryQuery(search_inputs)

  const discovery = await runRealWorldCompanyDiscovery(admin, {
    query: built_query,
    search_inputs,
    created_by: input.created_by,
    limit: input.limit ?? 50,
  })

  let companies = discovery.candidates.map((row, i) => {
    const ranked = row as GrowthRealWorldCompanyCandidate & { rank_score?: number }
    const rank_score =
      typeof ranked.rank_score === "number"
        ? ranked.rank_score
        : Math.max(0.1, discovery.candidates.length - i) * 0.01
    return realWorldCandidateToCompanyResult(row, rank_score, input.filters.industry ?? null)
  })

  if (discovery.schema_ready && companies.length > 0) {
    companies = await Promise.all(
      companies.map(async (company) => {
        try {
          const signals = await runCompanySignalIntelligence(admin, {
            company_candidate_id: company.id,
          })
          return attachCompanySignalSummaryToProspectCompany(
            company,
            signals.schema_ready ? signals.ui_summary : null,
          )
        } catch {
          return company
        }
      }),
    )
  }

  return {
    companies,
    discovery_run_id: discovery.run?.id ?? null,
    provider_messages: discovery.provider_messages,
    provider_status: discovery.provider_status,
    schema_ready: discovery.schema_ready,
    built_query,
    persist_warning: discovery.persist_warning ?? null,
  }
}
