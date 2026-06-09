/** Apollo-Primary-4 draft staging company resolution evidence — client-safe. */

import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ApolloPrimaryContactEnrollmentDraftStagingEvidence = {
  lookup_key: string
  staging_table_detected: string | null
  staging_row_id: string | null
  candidate_domain_normalized: string | null
  canonical_company_id: string | null
  queue_item_id: string | null
}

export type ApolloEnrollmentDraftStagingCompanyCandidate = {
  staging_row_id: string
  lookup_key: string
  source_table: string
  company_name: string
  website: string | null
  domain: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  phone: string | null
}

export function buildApolloEnrollmentDraftStagingEvidence(input: {
  lookup_key: string
  queue_item_id?: string | null
  staging_table_detected?: string | null
  staging_row_id?: string | null
  candidate_domain_normalized?: string | null
  canonical_company_id?: string | null
}): ApolloPrimaryContactEnrollmentDraftStagingEvidence {
  return {
    lookup_key: input.lookup_key,
    staging_table_detected: input.staging_table_detected ?? null,
    staging_row_id: input.staging_row_id ?? null,
    candidate_domain_normalized: input.candidate_domain_normalized ?? null,
    canonical_company_id: input.canonical_company_id ?? null,
    queue_item_id: input.queue_item_id ?? null,
  }
}

export function mapApolloEnrollmentDraftStagingRow(input: {
  lookup_key: string
  source_table: string
  staging_row_id: string
  row: Record<string, unknown>
  canonical_company_id?: string | null
  queue_item_id?: string | null
}): {
  company: ApolloEnrollmentDraftStagingCompanyCandidate
  staging_evidence: ApolloPrimaryContactEnrollmentDraftStagingEvidence
} {
  const domain = canonicalNormalizedDomain(asString(input.row.domain), asString(input.row.website))
  const canonical_company_id =
    input.canonical_company_id ?? (asString(input.row.canonical_company_id) || null)

  const staging_evidence = buildApolloEnrollmentDraftStagingEvidence({
    lookup_key: input.lookup_key,
    queue_item_id: input.queue_item_id ?? null,
    staging_table_detected: input.source_table,
    staging_row_id: input.staging_row_id,
    candidate_domain_normalized: domain,
    canonical_company_id,
  })

  return {
    company: {
      staging_row_id: input.staging_row_id,
      lookup_key: input.lookup_key,
      source_table: input.source_table,
      company_name: asString(input.row.company_name),
      website: asString(input.row.website) || null,
      domain,
      address: asString(input.row.address) || null,
      city: asString(input.row.city) || null,
      state: asString(input.row.state) || null,
      country: asString(input.row.country) || null,
      phone: asString(input.row.phone) || null,
    },
    staging_evidence,
  }
}
