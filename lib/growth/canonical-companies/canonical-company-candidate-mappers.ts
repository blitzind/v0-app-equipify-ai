import type {
  GrowthCanonicalCompanyCandidateInput,
  GrowthCanonicalCompanySourceTable,
} from "@/lib/growth/canonical-companies/canonical-company-types"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function safeMeta(row: Record<string, unknown>): Record<string, unknown> {
  const meta = row.metadata
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}
}

export function mapExternalCompanyCandidateRow(
  row: Record<string, unknown>,
): GrowthCanonicalCompanyCandidateInput {
  return {
    source_table: "external_company_candidates",
    source_id: asString(row.id),
    run_id: asString(row.run_id) || null,
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    company_name: asString(row.company_name) || "Unknown",
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    phone: asString(row.phone) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    industry: asString(row.industry) || null,
    confidence: asNum(row.confidence) ?? 0,
    observed_at: asString(row.created_at) || null,
    source_metadata: {
      dedupe_hash: asString(row.dedupe_hash),
      query: asString(row.query),
      category: asString(row.category),
      existing_customer_match: row.existing_customer_match === true,
      existing_prospect_match: row.existing_prospect_match === true,
      ...safeMeta(row),
    },
  }
}

export function mapRealWorldCompanyCandidateRow(
  row: Record<string, unknown>,
): GrowthCanonicalCompanyCandidateInput {
  return {
    source_table: "real_world_company_candidates",
    source_id: asString(row.id),
    run_id: asString(row.run_id) || null,
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    company_name: asString(row.company_name) || "Unknown",
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    phone: asString(row.phone) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    industry: asString(row.industry) || null,
    confidence: asNum(row.confidence) ?? 0,
    observed_at: asString(row.created_at) || null,
    source_metadata: {
      dedupe_hash: asString(row.dedupe_hash),
      query: asString(row.query),
      description: asString(row.description),
      existing_customer_match: row.existing_customer_match === true,
      existing_prospect_match: row.existing_prospect_match === true,
      ...safeMeta(row),
    },
  }
}

export function mapDiscoveryCandidateRow(
  row: Record<string, unknown>,
): GrowthCanonicalCompanyCandidateInput {
  return {
    source_table: "discovery_candidates",
    source_id: asString(row.id),
    run_id: asString(row.run_id) || null,
    provider_name: "",
    provider_type: asString(row.discovery_source_type) || asString(row.source_type),
    company_name: asString(row.company_name) || "Unknown",
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    industry: asString(row.industry) || null,
    confidence: asNum(row.source_confidence) ?? 0,
    observed_at: asString(row.discovered_at) || asString(row.created_at) || null,
    source_metadata: {
      dedupe_hash: asString(row.dedupe_hash),
      company_id: asString(row.company_id),
      reason_discovered: asString(row.reason_discovered),
      ...safeMeta(row),
    },
  }
}
