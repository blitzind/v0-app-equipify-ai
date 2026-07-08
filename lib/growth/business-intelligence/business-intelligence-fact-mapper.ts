/** GE-AIOS-8A-3 — Map Evidence Engine facts/evidence into BI report fields (client-safe). */

import type {
  AvaContradiction,
  AvaEvidenceItem,
  AvaFact,
  EvidenceEngineDecisionTier,
  EvidenceEngineProvider,
} from "@/lib/growth/evidence-engine/evidence-engine-types"
import type { EvidenceEngineSnapshotPayload } from "@/lib/growth/evidence-engine/evidence-engine-snapshot"
import type { BusinessIntelligenceReportField } from "@/lib/growth/business-intelligence/business-intelligence-types"

const UNKNOWN_FIELD_EXPLANATION = "No supporting evidence found in the Evidence Engine snapshot."

const WEAK_CONFIDENCE_THRESHOLD = 0.55

export type BusinessIntelligenceFactMappingSpec = {
  field_key: string
  fact_key_prefixes: string[]
  fact_key_exact?: string[]
  evidence_type_hints?: string[]
  aggregate?: "first" | "list" | "unique_list"
  explanation_label: string
}

export const BUSINESS_INTELLIGENCE_FIELD_SPECS: BusinessIntelligenceFactMappingSpec[] = [
  {
    field_key: "company.company_description",
    fact_key_exact: ["company.description"],
    aggregate: "first",
    explanation_label: "company description",
  },
  {
    field_key: "company.primary_offer",
    fact_key_exact: ["company.primary_value_proposition", "company.business_model"],
    aggregate: "first",
    explanation_label: "primary offer",
  },
  {
    field_key: "company.products",
    fact_key_prefixes: ["company.products"],
    aggregate: "unique_list",
    explanation_label: "products",
  },
  {
    field_key: "company.services",
    fact_key_prefixes: ["company.services", "company.products_services"],
    aggregate: "unique_list",
    explanation_label: "services",
  },
  {
    field_key: "company.plans_pricing",
    fact_key_prefixes: ["company.pricing_plans"],
    aggregate: "unique_list",
    explanation_label: "plans and pricing",
  },
  {
    field_key: "company.differentiators",
    fact_key_prefixes: ["sales_marketing.messaging_angles", "company.primary_value_proposition"],
    aggregate: "unique_list",
    explanation_label: "differentiators",
  },
  {
    field_key: "company.guarantees",
    fact_key_prefixes: ["company.guarantees"],
    aggregate: "unique_list",
    explanation_label: "guarantees",
  },
  {
    field_key: "company.support_channels",
    fact_key_prefixes: ["company.support_channels"],
    aggregate: "unique_list",
    explanation_label: "support channels",
  },
  {
    field_key: "market.industries_served",
    fact_key_prefixes: ["company.industries_served", "ideal_customers.target_industries"],
    aggregate: "unique_list",
    explanation_label: "industries served",
  },
  {
    field_key: "market.geographic_markets",
    fact_key_prefixes: ["company.geographic_markets", "ideal_customers.geography"],
    aggregate: "unique_list",
    explanation_label: "geographic markets",
  },
  {
    field_key: "market.customer_types",
    fact_key_prefixes: ["company.customers", "ideal_customers.buyer_personas"],
    aggregate: "unique_list",
    explanation_label: "customer types",
  },
  {
    field_key: "market.company_sizes_served",
    fact_key_prefixes: ["ideal_customers.company_size_ranges"],
    aggregate: "unique_list",
    explanation_label: "company sizes served",
  },
  {
    field_key: "market.buyer_terminology",
    fact_key_prefixes: ["terminology.buyer"],
    aggregate: "unique_list",
    explanation_label: "buyer terminology",
  },
  {
    field_key: "market.customer_terminology",
    fact_key_prefixes: ["terminology.customer"],
    aggregate: "unique_list",
    explanation_label: "customer terminology",
  },
  {
    field_key: "proof.testimonials",
    fact_key_prefixes: ["company.testimonials"],
    aggregate: "unique_list",
    explanation_label: "testimonials",
  },
  {
    field_key: "proof.case_studies",
    fact_key_prefixes: ["company.case_studies"],
    aggregate: "unique_list",
    explanation_label: "case studies",
  },
  {
    field_key: "proof.certifications",
    fact_key_prefixes: ["company.certifications"],
    aggregate: "unique_list",
    explanation_label: "certifications",
  },
  {
    field_key: "proof.integrations",
    fact_key_prefixes: ["company.integrations"],
    aggregate: "unique_list",
    explanation_label: "integrations",
  },
  {
    field_key: "proof.customer_examples",
    fact_key_prefixes: ["company.customers"],
    aggregate: "unique_list",
    explanation_label: "customer examples",
  },
  {
    field_key: "sales.likely_buyer_personas",
    fact_key_prefixes: ["ideal_customers.buyer_personas"],
    aggregate: "unique_list",
    explanation_label: "likely buyer personas",
  },
  {
    field_key: "sales.likely_pain_points",
    fact_key_prefixes: ["problems.pain_points"],
    aggregate: "unique_list",
    explanation_label: "likely pain points",
  },
  {
    field_key: "sales.likely_decision_triggers",
    fact_key_prefixes: ["problems.buying_triggers"],
    aggregate: "unique_list",
    explanation_label: "likely decision triggers",
  },
  {
    field_key: "sales.likely_objections",
    fact_key_prefixes: ["ideal_customers.disqualifiers", "problems.negative_keywords"],
    aggregate: "unique_list",
    explanation_label: "likely objections or disqualifiers",
  },
  {
    field_key: "sales.deal_size_signals",
    fact_key_exact: ["sales_marketing.average_deal_size"],
    aggregate: "first",
    explanation_label: "deal size signals",
  },
  {
    field_key: "sales.sales_cycle_signals",
    fact_key_exact: ["sales_marketing.sales_cycle_estimate"],
    aggregate: "first",
    explanation_label: "sales cycle signals",
  },
]

function matchesFact(spec: BusinessIntelligenceFactMappingSpec, fact: AvaFact): boolean {
  if (spec.fact_key_exact?.includes(fact.fact_key)) return true
  return (spec.fact_key_prefixes ?? []).some(
    (prefix) => fact.fact_key === prefix || fact.fact_key.startsWith(`${prefix}.`),
  )
}

function evidenceById(snapshot: EvidenceEngineSnapshotPayload): Map<string, AvaEvidenceItem> {
  return new Map(snapshot.evidence.map((item) => [item.evidence_id, item]))
}

function collectEvidenceForFact(
  fact: AvaFact,
  evidenceLookup: Map<string, AvaEvidenceItem>,
): AvaEvidenceItem[] {
  return fact.supporting_evidence_ids
    .map((id) => evidenceLookup.get(id))
    .filter((item): item is AvaEvidenceItem => Boolean(item))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function unknownField(spec: BusinessIntelligenceFactMappingSpec): BusinessIntelligenceReportField {
  return {
    value: null,
    confidence: 0,
    supporting_evidence_ids: [],
    source_providers: [],
    decision_tiers: [],
    lifecycle_status: "unknown",
    needs_review: false,
    explanation: `Unknown — ${UNKNOWN_FIELD_EXPLANATION} (${spec.explanation_label}).`,
  }
}

function buildFieldFromFacts(input: {
  spec: BusinessIntelligenceFactMappingSpec
  facts: AvaFact[]
  evidenceLookup: Map<string, AvaEvidenceItem>
  contradictions: AvaContradiction[]
}): BusinessIntelligenceReportField {
  const matchedFacts = input.facts.filter((fact) => matchesFact(input.spec, fact))
  if (matchedFacts.length === 0) return unknownField(input.spec)

  const evidenceItems = matchedFacts.flatMap((fact) => collectEvidenceForFact(fact, input.evidenceLookup))
  const supportingEvidenceIds = [...new Set(evidenceItems.map((item) => item.evidence_id))]
  const sourceProviders = [...new Set(evidenceItems.map((item) => item.provider))]
  const decisionTiers = [...new Set(evidenceItems.map((item) => item.decision_tier))]
  const lifecycleStatuses = matchedFacts.map((fact) => fact.lifecycle_status)
  const hasContradiction = input.contradictions.some((item) =>
    matchedFacts.some((fact) => fact.fact_key === item.fact_key),
  )
  const needsReview =
    hasContradiction ||
    matchedFacts.some(
      (fact) => fact.lifecycle_status === "needs_review" || fact.lifecycle_status === "contradicted",
    ) ||
    evidenceItems.some((item) => item.lifecycle_status === "needs_review" || item.lifecycle_status === "contradicted")

  const values = matchedFacts
    .map((fact) => fact.value_text?.trim())
    .filter((value): value is string => Boolean(value))

  let value: string | string[] | null = null
  if (input.spec.aggregate === "unique_list") {
    const list = uniqueStrings(values)
    value = list.length > 0 ? list : null
  } else {
    value = values[0] ?? null
  }

  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return unknownField(input.spec)
  }

  const confidence = average(matchedFacts.map((fact) => fact.confidence.overall_confidence))
  const lifecycle_status = needsReview
    ? lifecycleStatuses.includes("contradicted")
      ? "contradicted"
      : "needs_review"
    : lifecycleStatuses[0] ?? "active"

  const tierSummary = decisionTiers.join(", ")
  const providerSummary = sourceProviders.join(", ")

  return {
    value,
    confidence,
    supporting_evidence_ids: supportingEvidenceIds,
    source_providers: sourceProviders as EvidenceEngineProvider[],
    decision_tiers: decisionTiers as EvidenceEngineDecisionTier[],
    lifecycle_status,
    needs_review: needsReview,
    explanation: `Derived from ${matchedFacts.length} fact(s) and ${supportingEvidenceIds.length} evidence item(s) for ${input.spec.explanation_label} (providers: ${providerSummary}; tiers: ${tierSummary}).`,
  }
}

export function mapSnapshotToBusinessIntelligenceFields(
  snapshot: EvidenceEngineSnapshotPayload,
): Record<string, BusinessIntelligenceReportField> {
  const evidenceLookup = evidenceById(snapshot)
  const mapped: Record<string, BusinessIntelligenceReportField> = {}

  for (const spec of BUSINESS_INTELLIGENCE_FIELD_SPECS) {
    mapped[spec.field_key] = buildFieldFromFacts({
      spec,
      facts: snapshot.facts,
      evidenceLookup,
      contradictions: snapshot.contradictions,
    })
  }

  return mapped
}

export function isUnknownField(field: BusinessIntelligenceReportField): boolean {
  if (field.lifecycle_status === "unknown") return true
  if (field.value == null) return true
  if (Array.isArray(field.value) && field.value.length === 0) return true
  return false
}

export function isWeakField(field: BusinessIntelligenceReportField): boolean {
  if (isUnknownField(field)) return true
  if (field.confidence < WEAK_CONFIDENCE_THRESHOLD) return true
  if (field.decision_tiers.every((tier) => tier === "explicit_website" && field.confidence < 0.7)) return true
  return false
}

export function fieldHasOnlyWeakWebsiteEvidence(field: BusinessIntelligenceReportField): boolean {
  if (isUnknownField(field)) return false
  return (
    field.decision_tiers.length > 0 &&
    field.decision_tiers.every((tier) => tier === "explicit_website") &&
    field.confidence < WEAK_CONFIDENCE_THRESHOLD
  )
}
