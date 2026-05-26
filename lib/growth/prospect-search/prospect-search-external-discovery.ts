import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runExternalCompanyDiscovery } from "@/lib/growth/external-discovery/external-discovery-repository"
import type { GrowthExternalCompanyCandidate } from "@/lib/growth/external-discovery/external-discovery-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

function externalCandidateToCompanyResult(
  row: GrowthExternalCompanyCandidate & { rank_score?: number },
  rank_score: number,
): GrowthProspectSearchCompanyResult {
  const signals: string[] = []
  if (row.existing_customer_match) signals.push("Existing CRM customer match")
  if (row.existing_prospect_match) signals.push("Existing CRM prospect match")
  if (row.existing_growth_lead_match) signals.push("Existing Growth lead match")
  if (row.rating != null) signals.push(`Rating ${row.rating}`)
  if (row.category) signals.push(row.category)
  for (const ev of row.evidence.slice(0, 2)) {
    signals.push(ev.evidence)
  }

  const match_reasoning = [
    `Discovered via ${row.provider_type} (${row.provider_name}) — not an automatic lead.`,
    ...row.source_attribution.slice(0, 2).map((a) => a.evidence),
  ]

  return {
    id: row.id,
    source_type: "external_discovered",
    company_name: row.company_name,
    website: row.website,
    industry: row.industry,
    subindustry: row.category,
    employees: null,
    revenue_range: null,
    location: row.location,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: row.confidence,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals,
    search_intent_category: null,
    lead_inbox_id: null,
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
  }
}

export async function runProspectSearchExternalDiscovery(
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
  schema_ready: boolean
}> {
  const industry = input.filters.industry?.trim() || null
  const location = input.filters.location?.trim() || null

  const discovery = await runExternalCompanyDiscovery(admin, {
    query: input.query,
    industry,
    location,
    created_by: input.created_by,
    limit: input.limit ?? 50,
  })

  const companies = discovery.candidates.map((row, i) => {
    const ranked = row as GrowthExternalCompanyCandidate & { rank_score?: number }
    const rank_score =
      typeof ranked.rank_score === "number"
        ? ranked.rank_score
        : Math.max(0.1, discovery.candidates.length - i) * 0.01
    return externalCandidateToCompanyResult(row, rank_score)
  })

  return {
    companies,
    discovery_run_id: discovery.run?.id ?? null,
    provider_messages: discovery.provider_messages,
    schema_ready: discovery.schema_ready,
  }
}
