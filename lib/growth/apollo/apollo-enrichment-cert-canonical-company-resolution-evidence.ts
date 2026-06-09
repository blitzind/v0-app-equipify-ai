/** Apollo EN-3 canonical company resolution evidence — client-safe. */

export const APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER =
  "apollo-enrichment-cert-canonical-company-resolution-en-3-v1" as const

export type ApolloEnrichmentCertCanonicalCompanyResolutionEvidence = {
  qa_marker: typeof APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER
  lookup_key: string
  staging_table_detected: string | null
  staging_row_id: string | null
  candidate_domain_raw: string | null
  candidate_domain_normalized: string | null
  candidate_company_name: string | null
  staging_linkage_method: string | null
  staging_linkage_canonical_company_id: string | null
  domain_lookup_attempted: boolean
  domain_lookup_company_id: string | null
  name_lookup_attempted: boolean
  name_lookup_company_id: string | null
  name_lookup_method: string | null
  promote_backfill_ran: boolean
  promote_backfill_ok: boolean | null
  promote_backfill_company_ids: string[]
  promote_backfill_errors: string[]
  final_canonical_company_id: string | null
  blocker_reason: string | null
}

export function emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence(
  lookup_key: string,
): ApolloEnrichmentCertCanonicalCompanyResolutionEvidence {
  return {
    qa_marker: APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER,
    lookup_key,
    staging_table_detected: null,
    staging_row_id: null,
    candidate_domain_raw: null,
    candidate_domain_normalized: null,
    candidate_company_name: null,
    staging_linkage_method: null,
    staging_linkage_canonical_company_id: null,
    domain_lookup_attempted: false,
    domain_lookup_company_id: null,
    name_lookup_attempted: false,
    name_lookup_company_id: null,
    name_lookup_method: null,
    promote_backfill_ran: false,
    promote_backfill_ok: null,
    promote_backfill_company_ids: [],
    promote_backfill_errors: [],
    final_canonical_company_id: null,
    blocker_reason: null,
  }
}

export function summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure(
  evidence: ApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
): string {
  if (evidence.blocker_reason) return evidence.blocker_reason

  const parts: string[] = ["canonical_company_id_unresolved"]
  if (!evidence.staging_table_detected) {
    parts.push("staging_company_candidate_not_found")
  } else {
    parts.push(`staging_table=${evidence.staging_table_detected}`)
    if (evidence.staging_row_id) parts.push(`staging_row_id=${evidence.staging_row_id}`)
  }
  if (evidence.candidate_domain_normalized) {
    parts.push(`domain=${evidence.candidate_domain_normalized}`)
  } else {
    parts.push("candidate_domain_missing")
  }
  if (evidence.domain_lookup_attempted && !evidence.domain_lookup_company_id) {
    parts.push("no_active_canonical_company_for_domain")
  }
  if (evidence.name_lookup_attempted && !evidence.name_lookup_company_id) {
    parts.push("no_active_canonical_company_for_name")
  }
  if (evidence.promote_backfill_ran) {
    if (evidence.promote_backfill_ok === false) {
      parts.push(
        `promote_backfill_failed:${evidence.promote_backfill_errors.join("|") || "unknown"}`,
      )
    } else if (evidence.promote_backfill_company_ids.length === 0) {
      parts.push("promote_backfill_no_company_id")
    }
  } else if (evidence.staging_table_detected) {
    parts.push("promote_backfill_not_run")
  }
  return parts.join("; ")
}
