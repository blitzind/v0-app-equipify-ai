/** Pure Prospect Search market intelligence overlay helpers. Client-safe. */

import {
  computeCommitteeCompletion,
  committeeCompletionToCoverageConfidence,
  type CommitteeCompletionRole,
} from "@/lib/growth/committee-intelligence/committee-completion-engine"
import {
  computeCompanyConfidenceScore,
  freshnessConfidenceFromAgeDays,
} from "@/lib/growth/confidence-intelligence/company-confidence-scoring"
import type { GrowthCompanyConfidenceScore } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"
import type { GrowthCompanyRelationship } from "@/lib/growth/market-intelligence/market-intelligence-types"
import { finalizeProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-result-finalize"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type GrowthProspectSearchCommitteeCompletion = {
  completion_pct: number
  completion_label: "0%" | "25%" | "50%" | "75%" | "100%"
  missing_roles: CommitteeCompletionRole[]
}

export const COMMITTEE_ROLE_LABELS: Record<CommitteeCompletionRole, string> = {
  owner: "Owner",
  operations: "Operations",
  service_manager: "Service Manager",
  finance: "Finance",
  dispatcher: "Dispatcher",
  field_leadership: "Field Leadership",
}

export function computeProspectSearchCommitteeCompletion(
  company: GrowthProspectSearchCompanyResult,
): GrowthProspectSearchCommitteeCompletion {
  const contacts =
    company.contact_intelligence?.contacts.map((contact) => ({
      full_name: contact.name,
      job_title: contact.title,
      title: contact.title,
    })) ?? []

  const committee = computeCommitteeCompletion(contacts)
  return {
    completion_pct: committee.completion_pct,
    completion_label: committee.completion_label,
    missing_roles: committee.missing_roles,
  }
}

export function computeProspectSearchCompanyConfidence(
  company: GrowthProspectSearchCompanyResult,
  committee: GrowthProspectSearchCommitteeCompletion,
): GrowthCompanyConfidenceScore | null {
  const discoveryConfidence =
    company.source_type === "external_discovered"
      ? Math.round((company.company_match_confidence ?? company.confidence ?? 0) * 100)
      : company.confidence != null
        ? Math.round(company.confidence * 100)
        : null

  const contactConfidence = company.contact_intelligence?.contact_confidence_score ?? null
  const signalConfidence =
    company.growth_signal_score ??
    (company.signal_confidence != null ? Math.round(company.signal_confidence * 100) : null)

  const lastVerified = company.growth_signal_last_computed_at ?? null
  const ageDays = lastVerified ? (Date.now() - Date.parse(lastVerified)) / (1000 * 60 * 60 * 24) : null

  const evidence: GrowthCompanyConfidenceScore["evidence"] = []
  if (discoveryConfidence != null && discoveryConfidence > 0) {
    evidence.push({
      dimension: "discovery",
      score: discoveryConfidence,
      excerpt: company.discovery_source_badge
        ? `Discovery source: ${company.discovery_source_badge}`
        : "Indexed company discovery confidence",
    })
  }
  if (contactConfidence != null && contactConfidence > 0) {
    evidence.push({
      dimension: "contact",
      score: contactConfidence,
      excerpt: company.contact_intelligence?.contact_coverage_label
        ? `Contact coverage: ${company.contact_intelligence.contact_coverage_label}`
        : "Contact evidence confidence recorded",
    })
  }
  if (signalConfidence != null && signalConfidence > 0) {
    evidence.push({
      dimension: "signal",
      score: signalConfidence,
      excerpt: company.growth_signal_tier
        ? `Growth signal tier: ${company.growth_signal_tier}`
        : "Growth signal confidence recorded",
    })
  }
  if (committee.completion_pct > 0) {
    evidence.push({
      dimension: "coverage",
      score: committee.completion_pct,
      excerpt: `Committee completion ${committee.completion_label}`,
    })
  }
  const freshness = freshnessConfidenceFromAgeDays(ageDays)
  if (freshness > 0 && lastVerified) {
    evidence.push({
      dimension: "freshness",
      score: freshness,
      excerpt: `Last verified ${Math.round(ageDays ?? 0)} day(s) ago`,
    })
  }

  if (evidence.length === 0) return null

  return computeCompanyConfidenceScore({
    company_id: company.id,
    discovery_confidence: discoveryConfidence,
    contact_confidence: contactConfidence,
    signal_confidence: signalConfidence,
    coverage_confidence: committeeCompletionToCoverageConfidence(committee.completion_pct),
    freshness_confidence: freshness,
    evidence,
  })
}

export function applyMarketIntelligenceToCompanyResult(
  company: GrowthProspectSearchCompanyResult,
  overlay: {
    related_companies: GrowthCompanyRelationship[]
    company_confidence: GrowthCompanyConfidenceScore | null
    committee_completion: GrowthProspectSearchCommitteeCompletion
  },
): GrowthProspectSearchCompanyResult {
  return finalizeProspectSearchCompanyResult({
    ...company,
    related_companies: overlay.related_companies,
    company_confidence: overlay.company_confidence,
    committee_completion: overlay.committee_completion,
  })
}
