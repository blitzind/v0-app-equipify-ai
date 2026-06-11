/** Apollo intelligence recovery funnel snapshots — client-safe. */

import { selectApollo25CompanyPilotCandidates } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { ApolloIntelligenceRecoveryFunnelSnapshot } from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
import {
  buildApolloIntelligenceRecoveryScoreDecompositionRow,
  countCompaniesWithQualificationAboveThreshold,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"

export function buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
  inputs: Apollo25CompanyPilotSelectionInput[],
  production_threshold: number,
): ApolloIntelligenceRecoveryFunnelSnapshot {
  const selection = selectApollo25CompanyPilotCandidates(inputs, {
    production_threshold,
    pilot_selection_mode: "greenfield",
  })

  let verified_email_companies = 0
  let sequence_ready_companies = 0
  for (const input of inputs) {
    if (input.snapshot_summary.verified_email_contacts > 0) verified_email_companies += 1
    if (input.snapshot_summary.sequence_ready_contacts > 0) sequence_ready_companies += 1
  }

  const decompositionRows = inputs.map((input) =>
    buildApolloIntelligenceRecoveryScoreDecompositionRow({
      company_candidate_id: input.company_candidate_id,
      company_name: input.company_name,
      contacts: input.contacts,
      snapshot_summary: input.snapshot_summary,
      qualificationContext: {
        company_intelligence_present: input.company_intelligence_present ?? false,
        buying_committee_present: input.buying_committee_present ?? false,
        buying_committee_coverage: input.buying_committee_coverage ?? null,
        fit_score: input.fit_score ?? null,
        research_score: input.research_score ?? null,
      },
      production_threshold,
    }),
  )

  return {
    discovered_companies: inputs.length,
    verified_email_companies,
    sequence_ready_companies,
    score_gte_threshold_companies: countCompaniesWithQualificationAboveThreshold(
      decompositionRows,
      production_threshold,
    ),
    eligible_greenfield_companies: selection.eligible_pool_count,
  }
}
