/** Prospect Search — deterministic company resolution logic (7.PS-E). Client-safe. */

import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { companyResolutionConfidence } from "@/lib/growth/prospect-search/prospect-search-coverage-metrics"
import type { ProspectSearchCompanyResolutionCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export type ProspectSearchDomainResolutionIndex = {
  by_normalized_domain: Map<string, { company_id: string; method: "companies_primary_domain" | "company_domains_alias" }>
  staging_candidate_by_id: Map<string, { canonical_company_id: string; table: string }>
  staging_candidate_by_domain: Map<string, { canonical_company_id: string; table: string; candidate_id: string }>
}

function resolveCompanyFromDomainIndex(
  domain: string | null,
  index: ProspectSearchDomainResolutionIndex,
): Pick<ProspectSearchCompanyResolutionCoverage, "canonical_company_id" | "method" | "evidence"> | null {
  if (!domain) return null
  const hit = index.by_normalized_domain.get(domain)
  if (hit) {
    return {
      canonical_company_id: hit.company_id,
      method: hit.method,
      evidence: [
        hit.method === "companies_primary_domain"
          ? `Active canonical company primary_domain matches ${domain}`
          : `company_domains alias matches normalized domain ${domain}`,
      ],
    }
  }
  const staging = index.staging_candidate_by_domain.get(domain)
  if (staging) {
    return {
      canonical_company_id: staging.canonical_company_id,
      method: "staging_candidate_domain",
      evidence: [
        `${staging.table} row ${staging.candidate_id} links domain ${domain} to canonical company`,
      ],
    }
  }
  return null
}

function buildUnresolvedCompanyCoverage(
  normalized_domain: string | null,
  reasons: string[],
): ProspectSearchCompanyResolutionCoverage {
  return {
    canonical_company_id: null,
    resolved: false,
    confidence: 0,
    method: "unresolved",
    reasons,
    evidence: [],
    unresolved_company: true,
    normalized_domain,
  }
}

export function resolveProspectSearchCompanyCoverage(input: {
  source_type: GrowthProspectSearchSourceType
  id: string
  growth_lead_id: string | null
  website?: string | null
  lead_metadata?: Record<string, unknown> | null
  index: ProspectSearchDomainResolutionIndex
}): ProspectSearchCompanyResolutionCoverage {
  const normalized_domain = canonicalNormalizedDomain(null, input.website)
  const reasons: string[] = []
  const evidence: string[] = []

  if (input.growth_lead_id && input.lead_metadata) {
    const metadata = metaRecord(input.lead_metadata)
    const direct = asString(metadata.canonical_company_id)
    if (direct) {
      return {
        canonical_company_id: direct,
        resolved: true,
        confidence: companyResolutionConfidence("lead_metadata_canonical"),
        method: "lead_metadata_canonical",
        reasons: [],
        evidence: ["Lead metadata canonical_company_id is set (7.2 lineage)"],
        unresolved_company: false,
        normalized_domain,
      }
    }

    const candidateId =
      asString(metadata.company_candidate_id) ||
      asString(metadata.external_company_candidate_id) ||
      asString(metadata.real_world_company_candidate_id)
    if (candidateId) {
      const staging = input.index.staging_candidate_by_id.get(candidateId)
      if (staging) {
        return {
          canonical_company_id: staging.canonical_company_id,
          resolved: true,
          confidence: companyResolutionConfidence("lead_staging_lineage"),
          method: "lead_staging_lineage",
          reasons: [],
          evidence: [
            `Lead metadata references ${staging.table} ${candidateId} with canonical_company_id`,
          ],
          unresolved_company: false,
          normalized_domain,
        }
      }
      reasons.push(`Lead staging candidate ${candidateId} has no canonical_company_id yet`)
    }
  }

  if (input.source_type === "external_discovered") {
    const staging = input.index.staging_candidate_by_id.get(input.id)
    if (staging) {
      return {
        canonical_company_id: staging.canonical_company_id,
        resolved: true,
        confidence: companyResolutionConfidence("staging_candidate_id"),
        method: "staging_candidate_id",
        reasons: [],
        evidence: [`${staging.table} id ${input.id} carries canonical_company_id`],
        unresolved_company: false,
        normalized_domain,
      }
    }
    reasons.push("External company candidate row has no canonical_company_id")
  }

  const fromDomain = resolveCompanyFromDomainIndex(normalized_domain, input.index)
  if (fromDomain) {
    return {
      canonical_company_id: fromDomain.canonical_company_id,
      resolved: true,
      confidence: companyResolutionConfidence(fromDomain.method),
      method: fromDomain.method,
      reasons,
      evidence: [...evidence, ...fromDomain.evidence],
      unresolved_company: false,
      normalized_domain,
    }
  }

  if (!normalized_domain) {
    reasons.push("No website/domain available for domain-based canonical matching")
  } else {
    reasons.push(`No canonical company match for domain ${normalized_domain}`)
  }

  return buildUnresolvedCompanyCoverage(normalized_domain, reasons)
}
