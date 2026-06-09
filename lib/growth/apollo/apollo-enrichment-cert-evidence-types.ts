/** Apollo EN-1 enrichment certification evidence — client-safe. */

import type { ApolloEnrichmentPathAuditEntry } from "@/lib/growth/apollo/apollo-enrichment-cert-audit"
import type { ApolloEnrichmentCertCanonicalCompanyResolutionEvidence } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"

export const APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER = "apollo-enrichment-cert-evidence-en-1-v1" as const

export type ApolloEnrichmentCertGoNoGo = "go" | "no_go" | "conditional"

export type ApolloEnrichmentCertEvidence = {
  qa_marker: typeof APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER
  cert_at: string
  mock: boolean
  company: {
    company_candidate_id: string
    company_name: string
    domain: string | null
    canonical_company_id: string | null
  }
  gates: {
    enrich_emails: boolean
    enrich_emails_ack: boolean
    en_1_cert_enabled: boolean
    en_1_cert_ack: boolean
    max_people: number
  }
  recommended_path: Pick<
    ApolloEnrichmentPathAuditEntry,
    "path_id" | "name" | "credit_cost" | "env_gates"
  >
  enrichment: {
    candidates_eligible: number
    candidates_with_apollo_person_id: number
    bulk_match_batches: number
    credits_consumed: number
    candidates_updated: number
  }
  channels: {
    emails_found: number
    phones_found: number
    linkedin_found: number
    verified_emails: number
    before: { email: number; phone: number; linkedin: number }
    after: { email: number; phone: number; linkedin: number }
  }
  promotion: {
    company_contacts_synced: number
    company_contacts_promoted: number
    enriched_candidates_with_email: number
    enriched_candidates_with_linkedin: number
    promotion_attempted: boolean
    promotion_blockers: string[]
    company_contacts_created: number
    company_contacts_updated: number
    contactable_after_promotion: number
    sequence_ready_after_promotion: number
    canonical_company_resolution?: ApolloEnrichmentCertCanonicalCompanyResolutionEvidence | null
    canonical_person_backfill_rows_processed: number
    canonical_person_backfill_persons_linked: number
    rejection_reasons: Record<string, number>
  }
  readiness: {
    sequence_ready: number
    contactable: number
  }
  runtime: {
    duration_ms: number
    api_calls: number
    errors: string[]
  }
  certification: {
    go_no_go: ApolloEnrichmentCertGoNoGo
    reasons: string[]
  }
}

export function certifyApolloEnrichmentGoNoGo(
  evidence: Pick<
    ApolloEnrichmentCertEvidence,
    "enrichment" | "channels" | "promotion" | "runtime" | "gates"
  >,
): { go_no_go: ApolloEnrichmentCertGoNoGo; reasons: string[] } {
  const reasons: string[] = []

  if (evidence.runtime.errors.length > 0) {
    reasons.push(`Runtime errors: ${evidence.runtime.errors.length}`)
    return { go_no_go: "no_go", reasons }
  }

  if (evidence.enrichment.candidates_with_apollo_person_id === 0) {
    reasons.push("No Apollo person IDs available on channel-less candidates.")
    return { go_no_go: "no_go", reasons }
  }

  if (
    evidence.enrichment.bulk_match_batches === 0 &&
    evidence.enrichment.candidates_eligible > 0 &&
    !evidence.gates.enrich_emails
  ) {
    reasons.push("Enrichment gates blocked bulk_match.")
    return { go_no_go: "no_go", reasons }
  }

  const channelsGained =
    evidence.channels.after.email - evidence.channels.before.email +
    evidence.channels.after.phone - evidence.channels.before.phone +
    evidence.channels.after.linkedin - evidence.channels.before.linkedin

  if (channelsGained > 0) {
    reasons.push(
      `Channels obtained after bulk_match: +${evidence.channels.after.email - evidence.channels.before.email} email, +${evidence.channels.after.phone - evidence.channels.before.phone} phone, +${evidence.channels.after.linkedin - evidence.channels.before.linkedin} LinkedIn.`,
    )
    if (evidence.promotion?.company_contacts_synced > 0) {
      reasons.push(`${evidence.promotion.company_contacts_synced} company contact(s) synced.`)
    } else if (
      evidence.channels.after.email - evidence.channels.before.email +
        evidence.channels.after.phone - evidence.channels.before.phone +
        evidence.channels.after.linkedin - evidence.channels.before.linkedin >
        0 &&
      (evidence.promotion?.promotion_blockers?.length ?? 0) > 0
    ) {
      reasons.push(
        `Promotion blocked after enrichment: ${(evidence.promotion?.promotion_blockers ?? []).slice(0, 3).join("; ")}`,
      )
    }
    return { go_no_go: "go", reasons }
  }

  if (evidence.enrichment.credits_consumed > 0) {
    reasons.push(
      "Credits consumed but no new channels revealed — Apollo may not hold email/phone for these search-only rows.",
    )
    return { go_no_go: "conditional", reasons }
  }

  reasons.push("Enrichment completed without credit spend; no new channels observed (mock or blocked).")
  return { go_no_go: "conditional", reasons }
}
