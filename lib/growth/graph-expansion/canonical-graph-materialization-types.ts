/** Phase 7.PS-HT — Canonical graph materialization types. Client-safe. */

export const GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER =
  "growth-canonical-graph-materialization-7-ps-ht-v1" as const

/** Aligns with canonical resolver "new" method base confidence (0.55 × 100). */
export const GROWTH_CANONICAL_GRAPH_MATERIALIZATION_MIN_SOURCE_CONFIDENCE = 55

/** PS-HE / graph expansion ICP industry labels observed on discovery_candidates. */
export const GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS = [
  "biomedical",
  "medical equipment repair",
  "biomedical equipment service",
] as const

export type CanonicalGraphMaterializationBlocker =
  | "already_materialized"
  | "suppressed"
  | "duplicate"
  | "missing_company_name"
  | "source_confidence_below_threshold"
  | "missing_evidence_and_domain"
  | "new_company_without_domain_or_evidence"
  | "promotion_error"

export type CanonicalGraphMaterializationEligibility = {
  eligible: boolean
  blocked_reason: CanonicalGraphMaterializationBlocker | null
  has_evidence: boolean
  has_domain: boolean
}

export type CanonicalGraphMaterializationMetrics = {
  candidates_discovered: number
  candidates_eligible: number
  candidates_blocked: number
  candidates_promoted: number
  candidates_linked_existing: number
  companies_added: number
  persons_promoted: number
  promotion_rate_pct: number
  blockers_by_reason: Partial<Record<CanonicalGraphMaterializationBlocker, number>>
}

export type CanonicalGraphMaterializationResult = {
  qa_marker: typeof GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER
  ok: boolean
  metrics: CanonicalGraphMaterializationMetrics
  promoted_companies: Array<{
    discovery_candidate_id: string
    real_world_candidate_id: string | null
    canonical_company_id: string
    company_name: string
    resolution_method: string
    created_new: boolean
  }>
  blocked_samples: Array<{
    discovery_candidate_id: string
    company_name: string
    blocked_reason: CanonicalGraphMaterializationBlocker
  }>
  messages: string[]
}
