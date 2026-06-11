/** Apollo qualification scoring context helpers — client-safe (recovery + pilot). */

import type { ApolloIntelligenceRecoveryQualificationContext } from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

export function shouldLoadApolloQualificationScoringRunArtifacts(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): { company_intelligence: boolean; buying_committee: boolean } {
  return {
    company_intelligence: engine?.company_intelligence?.has_verified_intelligence !== true,
    buying_committee: (engine?.buying_committee?.member_count ?? 0) === 0,
  }
}

export function applyApolloQualificationScoringContextToSelectionInput(
  input: Apollo25CompanyPilotSelectionInput,
  context: ApolloIntelligenceRecoveryQualificationContext,
): Apollo25CompanyPilotSelectionInput {
  return {
    ...input,
    company_intelligence_present: context.company_intelligence_present,
    buying_committee_present: context.buying_committee_present,
    buying_committee_coverage: context.buying_committee_coverage,
    fit_score: context.fit_score,
    research_score: context.research_score,
  }
}
