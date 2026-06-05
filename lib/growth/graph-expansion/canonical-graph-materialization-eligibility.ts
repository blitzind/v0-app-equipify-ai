/** Phase 7.PS-HT — Discovery candidate materialization eligibility (client-safe). */

import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  GROWTH_CANONICAL_GRAPH_MATERIALIZATION_MIN_SOURCE_CONFIDENCE,
  type CanonicalGraphMaterializationEligibility,
} from "@/lib/growth/graph-expansion/canonical-graph-materialization-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function hasEvidenceRows(
  evidence: Array<{ claim?: string; evidence?: string }> | null | undefined,
): boolean {
  if (!Array.isArray(evidence)) return false
  return evidence.some((row) => asString(row.claim) && asString(row.evidence))
}

export function evaluateDiscoveryCandidateMaterializationEligibility(input: {
  company_name?: string | null
  website?: string | null
  domain?: string | null
  source_confidence?: number | null
  evidence?: Array<{ claim?: string; evidence?: string }> | null
  is_suppressed?: boolean | null
  is_duplicate?: boolean | null
  canonical_company_id?: string | null
}): CanonicalGraphMaterializationEligibility {
  const has_evidence = hasEvidenceRows(input.evidence)
  const has_domain = Boolean(canonicalNormalizedDomain(input.domain, input.website))

  if (asString(input.canonical_company_id)) {
    return { eligible: false, blocked_reason: "already_materialized", has_evidence, has_domain }
  }
  if (input.is_suppressed === true) {
    return { eligible: false, blocked_reason: "suppressed", has_evidence, has_domain }
  }
  if (input.is_duplicate === true) {
    return { eligible: false, blocked_reason: "duplicate", has_evidence, has_domain }
  }

  const company_name = asString(input.company_name)
  if (!company_name || company_name.toLowerCase() === "unknown") {
    return { eligible: false, blocked_reason: "missing_company_name", has_evidence, has_domain }
  }

  const source_confidence = Number(input.source_confidence ?? 0)
  if (source_confidence < GROWTH_CANONICAL_GRAPH_MATERIALIZATION_MIN_SOURCE_CONFIDENCE) {
    return {
      eligible: false,
      blocked_reason: "source_confidence_below_threshold",
      has_evidence,
      has_domain,
    }
  }

  if (!has_evidence && !has_domain) {
    return {
      eligible: false,
      blocked_reason: "missing_evidence_and_domain",
      has_evidence,
      has_domain,
    }
  }

  return { eligible: true, blocked_reason: null, has_evidence, has_domain }
}

export function evaluateNewCanonicalCompanyCreationEligibility(input: {
  would_create_new: boolean
  normalized_domain: string | null
  has_evidence: boolean
}): CanonicalGraphMaterializationEligibility {
  if (!input.would_create_new) {
    return {
      eligible: true,
      blocked_reason: null,
      has_evidence: input.has_evidence,
      has_domain: Boolean(input.normalized_domain),
    }
  }
  if (!input.normalized_domain && !input.has_evidence) {
    return {
      eligible: false,
      blocked_reason: "new_company_without_domain_or_evidence",
      has_evidence: input.has_evidence,
      has_domain: Boolean(input.normalized_domain),
    }
  }
  return {
    eligible: true,
    blocked_reason: null,
    has_evidence: input.has_evidence,
    has_domain: Boolean(input.normalized_domain),
  }
}
