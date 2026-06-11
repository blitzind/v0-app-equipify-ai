/** Apollo intelligence recovery audits — canonical + intelligence availability (client-safe builders). */

import type { ApolloEnrichmentCertCanonicalCompanyResolutionEvidence } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"
import type {
  ApolloIntelligenceRecoveryCanonicalAuditRow,
  ApolloIntelligenceRecoveryIntelligenceAuditRow,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"
import {
  buildApolloIntelligenceRecoveryQualificationContext,
  resolveApolloIntelligenceRecoveryFitScores,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

export function buildApolloIntelligenceRecoveryCanonicalAuditRow(input: {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  evidence: ApolloEnrichmentCertCanonicalCompanyResolutionEvidence
  resolution_blockers: string[]
}): ApolloIntelligenceRecoveryCanonicalAuditRow {
  const evidence = input.evidence
  const matched_by_domain = Boolean(evidence.domain_lookup_company_id)
  const matched_by_normalized_name = evidence.name_lookup_method === "normalized_name"
  const matched_by_name_city = evidence.name_lookup_method === "name_city"
  const matched_by_name_state = evidence.name_lookup_method === "name_state"
  const matched_by_staging_linkage = Boolean(evidence.staging_linkage_canonical_company_id)

  const unresolved = !input.canonical_company_id
  const can_safely_link_or_create =
    unresolved &&
    (Boolean(evidence.candidate_domain_normalized) || Boolean(evidence.candidate_company_name))

  let resolution_method: string | null = null
  if (input.canonical_company_id) {
    if (matched_by_staging_linkage && evidence.staging_linkage_method) {
      resolution_method = evidence.staging_linkage_method
    } else if (matched_by_domain) resolution_method = "domain"
    else if (matched_by_name_city) resolution_method = "name_city"
    else if (matched_by_name_state) resolution_method = "name_state"
    else if (matched_by_normalized_name) resolution_method = "normalized_name"
    else if (evidence.promote_backfill_ok) resolution_method = "promote_backfill"
    else resolution_method = "resolved"
  }

  return {
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    canonical_company_id: input.canonical_company_id,
    matched_by_domain,
    matched_by_normalized_name,
    matched_by_name_city,
    matched_by_name_state,
    matched_by_staging_linkage,
    unresolved,
    blocker_reason: unresolved
      ? evidence.blocker_reason ?? input.resolution_blockers.join("; ")
      : null,
    can_safely_link_or_create,
    resolution_method,
  }
}

export function buildApolloIntelligenceRecoveryIntelligenceAuditRow(input: {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  engine: GrowthProspectSearchEngineIntelligence | null
  latest_research_run_id?: string | null
  research_cache_stale_or_missing?: boolean
}): ApolloIntelligenceRecoveryIntelligenceAuditRow {
  const engine = input.engine
  const qualificationContext = buildApolloIntelligenceRecoveryQualificationContext(engine)
  const fitScores = resolveApolloIntelligenceRecoveryFitScores(engine)

  const missing_inputs: string[] = []
  if (!input.canonical_company_id) missing_inputs.push("canonical_company_id")
  if (!engine?.schema_ready) missing_inputs.push("intelligence_schema_not_ready")
  if (!engine?.company_intelligence?.has_verified_intelligence) {
    missing_inputs.push("company_intelligence_verified")
  }
  if (!qualificationContext.buying_committee_present) {
    missing_inputs.push("buying_committee")
  }
  if (fitScores.fit_score == null) missing_inputs.push("fit_score")
  if (fitScores.research_score == null) missing_inputs.push("research_score")
  if (!input.latest_research_run_id) missing_inputs.push("latest_research_run")
  if (input.research_cache_stale_or_missing) missing_inputs.push("research_cache_stale_or_missing")

  return {
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    canonical_company_id: input.canonical_company_id,
    company_intelligence_exists: Boolean(engine?.company_intelligence),
    company_intelligence_verified: engine?.company_intelligence?.has_verified_intelligence === true,
    buying_committee_exists: qualificationContext.buying_committee_present,
    buying_committee_member_count: engine?.buying_committee?.member_count ?? 0,
    buying_committee_coverage: qualificationContext.buying_committee_coverage,
    fit_score_exists: fitScores.fit_score != null,
    fit_score_value: fitScores.fit_score,
    research_score_exists: fitScores.research_score != null,
    research_score_value: fitScores.research_score,
    latest_research_run_exists: Boolean(input.latest_research_run_id),
    latest_research_run_id: input.latest_research_run_id ?? null,
    research_cache_stale_or_missing: input.research_cache_stale_or_missing ?? !input.latest_research_run_id,
    missing_inputs,
  }
}
