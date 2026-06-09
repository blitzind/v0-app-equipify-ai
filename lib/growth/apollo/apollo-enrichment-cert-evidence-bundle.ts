/** Apollo EN-2 production enrichment cert evidence bundle — client-safe. */

import type { ApolloEnrichmentCertEvidence } from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-types"

export const APOLLO_ENRICHMENT_CERT_EVIDENCE_BUNDLE_QA_MARKER =
  "apollo-enrichment-cert-evidence-bundle-en-2-v1" as const

export type ApolloEnrichmentCertEvidenceBundle = {
  qa_marker: typeof APOLLO_ENRICHMENT_CERT_EVIDENCE_BUNDLE_QA_MARKER
  captured_at: string
  ok: boolean
  mock: boolean
  company: ApolloEnrichmentCertEvidence["company"]
  enrichment: {
    candidates_processed: number
    candidates_updated: number
    emails_found: number
    phones_found: number
    linkedin_found: number
    credits_consumed: number
    api_calls: number
  }
  promotion: {
    company_contacts_synced: number
    canonical_person_matches: number
    canonical_company_matches: number
    enriched_candidates_with_email: number
    enriched_candidates_with_linkedin: number
    promotion_attempted: boolean
    promotion_blockers: string[]
    company_contacts_created: number
    company_contacts_updated: number
    contactable_after_promotion: number
    sequence_ready_after_promotion: number
  }
  readiness: {
    contactable: number
    sequence_ready: number
  }
  cost: {
    cost_per_contactable: number | null
    cost_per_sequence_ready: number | null
  }
  verdict: "go" | "conditional" | "no_go"
  verdict_reasons: string[]
  errors: string[]
  evidence: ApolloEnrichmentCertEvidence
}

function safeCostRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

export function buildApolloEnrichmentCertEvidenceBundle(input: {
  evidence: ApolloEnrichmentCertEvidence
  ok: boolean
  canonical_person_matches?: number
  canonical_company_matches?: number
  captured_at?: string
}): ApolloEnrichmentCertEvidenceBundle {
  const credits = input.evidence.enrichment.credits_consumed
  const contactable = input.evidence.readiness.contactable
  const sequenceReady = input.evidence.readiness.sequence_ready

  return {
    qa_marker: APOLLO_ENRICHMENT_CERT_EVIDENCE_BUNDLE_QA_MARKER,
    captured_at: input.captured_at ?? input.evidence.cert_at,
    ok: input.ok,
    mock: input.evidence.mock,
    company: input.evidence.company,
    enrichment: {
      candidates_processed: input.evidence.enrichment.candidates_with_apollo_person_id,
      candidates_updated: input.evidence.enrichment.candidates_updated,
      emails_found: input.evidence.channels.emails_found,
      phones_found: input.evidence.channels.phones_found,
      linkedin_found: input.evidence.channels.linkedin_found,
      credits_consumed: credits,
      api_calls: input.evidence.runtime.api_calls,
    },
    promotion: {
      company_contacts_synced: input.evidence.promotion.company_contacts_synced,
      canonical_person_matches: input.canonical_person_matches ?? sequenceReady,
      canonical_company_matches:
        input.canonical_company_matches ?? (input.evidence.company.canonical_company_id ? 1 : 0),
      enriched_candidates_with_email: input.evidence.promotion.enriched_candidates_with_email,
      enriched_candidates_with_linkedin: input.evidence.promotion.enriched_candidates_with_linkedin,
      promotion_attempted: input.evidence.promotion.promotion_attempted,
      promotion_blockers: input.evidence.promotion.promotion_blockers,
      company_contacts_created: input.evidence.promotion.company_contacts_created,
      company_contacts_updated: input.evidence.promotion.company_contacts_updated,
      contactable_after_promotion: input.evidence.promotion.contactable_after_promotion,
      sequence_ready_after_promotion: input.evidence.promotion.sequence_ready_after_promotion,
    },
    readiness: {
      contactable,
      sequence_ready: sequenceReady,
    },
    cost: {
      cost_per_contactable: safeCostRatio(credits, contactable),
      cost_per_sequence_ready: safeCostRatio(credits, sequenceReady),
    },
    verdict: input.evidence.certification.go_no_go,
    verdict_reasons: input.evidence.certification.reasons,
    errors: input.evidence.runtime.errors,
    evidence: input.evidence,
  }
}
