/** Apollo qualification scoring context helpers — client-safe (recovery + pilot + enrollment). */

import type { ApolloEnrollmentQualificationInput } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import type { ApolloIntelligenceRecoveryQualificationContext } from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
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

export function buildApolloEnrollmentQualificationInputFromScoringContext(input: {
  snapshot_summary: {
    mapped_contacts: number
    verified_email_contacts: number
    contactable_contacts: number
    sequence_ready_contacts: number
  }
  contact: ApolloPrimaryContactOperatorReviewRow
  context: ApolloIntelligenceRecoveryQualificationContext
  apollo_search_tier?: string | null
  verified_email_source?: string | null
  enrichment_source?: string | null
}): ApolloEnrollmentQualificationInput {
  return {
    mapped_contacts: input.snapshot_summary.mapped_contacts,
    verified_email_contacts: input.snapshot_summary.verified_email_contacts,
    contactable_contacts: input.snapshot_summary.contactable_contacts,
    sequence_ready_contacts: input.snapshot_summary.sequence_ready_contacts,
    company_intelligence_present: input.context.company_intelligence_present,
    buying_committee_present: input.context.buying_committee_present,
    buying_committee_coverage: input.context.buying_committee_coverage,
    fit_score: input.context.fit_score,
    research_score: input.context.research_score,
    contact_sequence_ready: input.contact.sequence_ready,
    contact_contactable: input.contact.contactable,
    contact_blockers: input.contact.blockers,
    apollo_search_tier: input.apollo_search_tier ?? null,
    verified_email_source: input.verified_email_source ?? null,
    enrichment_source: input.enrichment_source ?? null,
  }
}
