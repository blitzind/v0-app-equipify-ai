/** Wire prospect search engine intelligence into pilot selection inputs — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import { mergeApolloIntelligenceRecoveryQualificationContext } from "@/lib/growth/apollo/apollo-intelligence-recovery-artifact-contract"
import type { GrowthBuyingCommitteeIntelligenceRunResult } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthCompanyIntelligenceRunResult } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { loadProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-loader"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function enrichApollo25CompanyPilotSelectionInputWithIntelligence(
  admin: SupabaseClient,
  input: Apollo25CompanyPilotSelectionInput,
  canonical_company_id?: string | null,
  artifact_overlay?: {
    company_intelligence_run?: GrowthCompanyIntelligenceRunResult | null
    buying_committee_run?: GrowthBuyingCommitteeIntelligenceRunResult | null
  },
): Promise<Apollo25CompanyPilotSelectionInput> {
  const engine = await loadProspectSearchEngineIntelligence(admin, {
    source_type: "external_discovered",
    id: input.company_candidate_id,
    growth_lead_id: input.growth_lead_id ?? null,
    canonical_company_id: canonical_company_id ?? null,
  })

  const context = mergeApolloIntelligenceRecoveryQualificationContext({
    engine,
    company_intelligence_run: artifact_overlay?.company_intelligence_run,
    buying_committee_run: artifact_overlay?.buying_committee_run,
  })

  return {
    ...input,
    company_intelligence_present: context.company_intelligence_present,
    buying_committee_present: context.buying_committee_present,
    buying_committee_coverage: context.buying_committee_coverage,
    fit_score: context.fit_score,
    research_score: context.research_score,
  }
}

export async function loadLatestProspectResearchRunIdForCompanyCandidate(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<string | null> {
  const { data: lead } = await admin
    .schema("growth")
    .from("leads")
    .select("latest_prospect_research_run_id, last_prospect_researched_at")
    .eq("external_ref", company_candidate_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const fromLead = asString(lead?.latest_prospect_research_run_id)
  if (fromLead) return fromLead

  const stagingTables = ["discovery_candidates", "external_company_candidates", "real_world_company_candidates"]
  for (const table of stagingTables) {
    const { data } = await admin
      .schema("growth")
      .from(table)
      .select("latest_prospect_research_run_id")
      .or(`company_id.eq.${company_candidate_id},id.eq.${company_candidate_id}`)
      .limit(1)
      .maybeSingle()
    const runId = asString((data as Record<string, unknown> | null)?.latest_prospect_research_run_id)
    if (runId) return runId
  }

  return null
}

export function isProspectResearchCacheStale(lastResearchedAt: string | null | undefined): boolean {
  if (!lastResearchedAt) return true
  const ts = Date.parse(lastResearchedAt)
  if (!Number.isFinite(ts)) return true
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  return Date.now() - ts > thirtyDaysMs
}
