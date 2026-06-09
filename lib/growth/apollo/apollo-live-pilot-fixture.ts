/** Deterministic Apollo AI-2 pilot evidence fixture for CI — client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_LIVE_PILOT_FIXTURE_QA_MARKER = "apollo-live-pilot-fixture-ai-2-v1" as const

export function buildApolloLivePilotMockEvidence(
  overrides?: Partial<ApolloLivePilotEvidence>,
): ApolloLivePilotEvidence {
  const base: ApolloLivePilotEvidence = {
    qa_marker: APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
    pilot_at: "2026-06-08T22:00:00.000Z",
    mock: true,
    company: {
      canonical_company_id: "11111111-1111-4111-8111-111111111111",
      company_candidate_id: "22222222-2222-4222-8222-222222222222",
      company_name: "Acme Biomedical Services",
      domain: "acmebiomed.com",
    },
    runtime: {
      duration_ms: 1840,
      api_calls: 0,
      credits_consumed: 0,
      errors: [],
    },
    discovery: {
      raw_contacts_returned: 4,
      contacts_mapped: 3,
      contacts_skipped: 1,
      contacts_rejected: 0,
      candidates_stored: 3,
      company_contacts_synced: 3,
    },
    canonical_matching: {
      company: { matched: 1, created: 0, deduped: 0, rejected: 0 },
      person: { matched: 1, created: 2, deduped: 0, rejected: 0 },
    },
    contact_quality: {
      decision_maker_count: 2,
      with_email: 2,
      with_phone: 1,
      with_verified_email: 1,
      with_linkedin: 2,
      irrelevant_title_skipped: 1,
      buying_committee_relevant: 2,
      average_decision_maker_score: 82,
      title_buckets: {
        owner_founder_president_ceo: 1,
        service_field_service_manager: 1,
        sales_marketing_admin_irrelevant: 1,
      },
    },
    research_pipeline: {
      company_intelligence_present: true,
      buying_committee_present: true,
      fit_score_present: true,
      relationship_intelligence_present: true,
      next_best_action_present: true,
      automated_flow_confirmed: true,
    },
    readiness_funnel: {
      imported: 3,
      research_complete: 3,
      score_available: 3,
      contactable: 2,
      sequence_ready: 1,
    },
  }

  return { ...base, ...overrides, company: { ...base.company, ...overrides?.company } }
}

export function buildApolloLivePilotLiveEvidenceTemplate(): ApolloLivePilotEvidence {
  return {
    ...buildApolloLivePilotMockEvidence(),
    mock: false,
    pilot_at: new Date().toISOString(),
    runtime: {
      duration_ms: 0,
      api_calls: 1,
      credits_consumed: 0,
      errors: [],
    },
  }
}
