/** GE-AIOS-8A-3 — Build deterministic Business Intelligence reports (client-safe). */

import type { EvidenceEngineSnapshotPayload } from "@/lib/growth/evidence-engine/evidence-engine-snapshot"
import {
  fieldHasOnlyWeakWebsiteEvidence,
  isUnknownField,
  isWeakField,
  mapSnapshotToBusinessIntelligenceFields,
} from "@/lib/growth/business-intelligence/business-intelligence-fact-mapper"
import type {
  BusinessIntelligenceConfidenceSummary,
  BusinessIntelligenceContradictionSummary,
  BusinessIntelligenceGap,
  BusinessIntelligenceGapCode,
  BusinessIntelligenceReport,
  BusinessIntelligenceReportSections,
} from "@/lib/growth/business-intelligence/business-intelligence-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

function field(map: Record<string, import("@/lib/growth/business-intelligence/business-intelligence-types").BusinessIntelligenceReportField>, key: string) {
  return map[key]!
}

function buildSections(map: Record<string, import("@/lib/growth/business-intelligence/business-intelligence-types").BusinessIntelligenceReportField>): BusinessIntelligenceReportSections {
  return {
    company: {
      company_description: field(map, "company.company_description"),
      primary_offer: field(map, "company.primary_offer"),
      products: field(map, "company.products"),
      services: field(map, "company.services"),
      plans_pricing: field(map, "company.plans_pricing"),
      differentiators: field(map, "company.differentiators"),
      guarantees: field(map, "company.guarantees"),
      support_channels: field(map, "company.support_channels"),
    },
    market: {
      industries_served: field(map, "market.industries_served"),
      geographic_markets: field(map, "market.geographic_markets"),
      customer_types: field(map, "market.customer_types"),
      company_sizes_served: field(map, "market.company_sizes_served"),
      buyer_terminology: field(map, "market.buyer_terminology"),
      customer_terminology: field(map, "market.customer_terminology"),
    },
    proof_and_trust: {
      testimonials: field(map, "proof.testimonials"),
      case_studies: field(map, "proof.case_studies"),
      certifications: field(map, "proof.certifications"),
      integrations: field(map, "proof.integrations"),
      customer_examples: field(map, "proof.customer_examples"),
    },
    sales_and_growth: {
      likely_buyer_personas: field(map, "sales.likely_buyer_personas"),
      likely_pain_points: field(map, "sales.likely_pain_points"),
      likely_decision_triggers: field(map, "sales.likely_decision_triggers"),
      likely_objections: field(map, "sales.likely_objections"),
      deal_size_signals: field(map, "sales.deal_size_signals"),
      sales_cycle_signals: field(map, "sales.sales_cycle_signals"),
    },
  }
}

function collectAllFields(sections: BusinessIntelligenceReportSections) {
  return [
    ...Object.values(sections.company),
    ...Object.values(sections.market),
    ...Object.values(sections.proof_and_trust),
    ...Object.values(sections.sales_and_growth),
  ]
}

function buildConfidenceSummary(input: {
  snapshot: EvidenceEngineSnapshotPayload
  fields: ReturnType<typeof collectAllFields>
}): BusinessIntelligenceConfidenceSummary {
  const knownFields = input.fields.filter((item) => !isUnknownField(item))
  const unknownCount = input.fields.filter((item) => isUnknownField(item)).length
  const needsReviewCount = input.fields.filter((item) => item.needs_review).length

  const freshnessValues = input.snapshot.evidence.map((item) => item.confidence.freshness_confidence)
  const freshnessStrength =
    freshnessValues.length > 0
      ? freshnessValues.reduce((sum, value) => sum + value, 0) / freshnessValues.length
      : 0

  return {
    overall_confidence:
      knownFields.length > 0
        ? knownFields.reduce((sum, item) => sum + item.confidence, 0) / knownFields.length
        : 0,
    evidence_strength: input.snapshot.confidence_summary.average_evidence_confidence,
    freshness_strength: freshnessStrength,
    contradiction_count: input.snapshot.contradictions.length,
    unknown_count: unknownCount,
    needs_review_count: needsReviewCount + input.snapshot.evidence_counts.needs_review_count,
  }
}

function hasApprovedProfileDescriptionConflict(snapshot: EvidenceEngineSnapshotPayload): boolean {
  const descriptionContradiction = snapshot.contradictions.find(
    (item) => item.fact_key === "company.description",
  )
  if (descriptionContradiction) return true

  const descriptionFacts = snapshot.facts.filter((fact) => fact.fact_key === "company.description")
  const providers = new Set<string>()
  for (const fact of descriptionFacts) {
    for (const evidenceId of fact.supporting_evidence_ids) {
      const evidence = snapshot.evidence.find((item) => item.evidence_id === evidenceId)
      if (evidence) providers.add(evidence.provider)
    }
  }

  return providers.has("website") && providers.has("approved_profile") && descriptionFacts.some((f) => f.lifecycle_status === "contradicted")
}

function createGap(input: Omit<BusinessIntelligenceGap, "gap_id">): BusinessIntelligenceGap {
  return {
    ...input,
    gap_id: `gap_${input.gap_code}`,
  }
}

export function detectBusinessIntelligenceGaps(input: {
  sections: BusinessIntelligenceReportSections
  snapshot: EvidenceEngineSnapshotPayload
  confidence_summary: BusinessIntelligenceConfidenceSummary
  teammateName?: string | null
}): BusinessIntelligenceGap[] {
  const gaps: BusinessIntelligenceGap[] = []
  const { sections, snapshot, confidence_summary } = input
  const teammate = resolveAiTeammatePresentation(input.teammateName)

  if (isUnknownField(sections.company.plans_pricing)) {
    gaps.push(
      createGap({
        gap_code: "missing_pricing_evidence",
        severity: "medium",
        title: "Pricing evidence missing",
        message: `No pricing or plan evidence was found. ${teammate.name} should ask the operator to confirm pricing positioning.`,
        related_fields: ["company.plans_pricing"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.market.industries_served)) {
    gaps.push(
      createGap({
        gap_code: "missing_industries_served",
        severity: "high",
        title: "Industries served unclear",
        message: "No industries served evidence was found in the Evidence Engine snapshot.",
        related_fields: ["market.industries_served"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.proof_and_trust.testimonials) && isUnknownField(sections.proof_and_trust.case_studies)) {
    gaps.push(
      createGap({
        gap_code: "missing_testimonials_or_case_studies",
        severity: "medium",
        title: "No testimonials or case studies found",
        message: `${teammate.name} found no testimonial or case study evidence on the website or approved profile.`,
        related_fields: ["proof.testimonials", "proof.case_studies"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.market.geographic_markets) || isWeakField(sections.market.geographic_markets)) {
    gaps.push(
      createGap({
        gap_code: "missing_geographic_markets",
        severity: "medium",
        title: "Geographic market unclear",
        message: "Geographic market coverage is missing or weak in available evidence.",
        related_fields: ["market.geographic_markets"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.sales_and_growth.likely_buyer_personas)) {
    gaps.push(
      createGap({
        gap_code: "missing_buyer_personas",
        severity: "medium",
        title: "Buyer personas not evidenced",
        message: "No buyer persona evidence was found. Likely personas remain unknown.",
        related_fields: ["sales.likely_buyer_personas"],
        requires_user_confirmation: true,
      }),
    )
  } else if (fieldHasOnlyWeakWebsiteEvidence(sections.sales_and_growth.likely_buyer_personas)) {
    gaps.push(
      createGap({
        gap_code: "weak_buyer_persona_evidence",
        severity: "low",
        title: "Buyer personas inferred from weak website evidence",
        message: "Buyer persona signals come only from weak explicit website evidence and should be confirmed.",
        related_fields: ["sales.likely_buyer_personas"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.sales_and_growth.likely_pain_points)) {
    gaps.push(
      createGap({
        gap_code: "missing_pain_points",
        severity: "medium",
        title: "Pain points not evidenced",
        message: "No pain point evidence was found in the snapshot.",
        related_fields: ["sales.likely_pain_points"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (isUnknownField(sections.company.support_channels)) {
    gaps.push(
      createGap({
        gap_code: "missing_support_channels",
        severity: "low",
        title: "Support channels not found",
        message: "No support channel evidence was found on the website or approved profile.",
        related_fields: ["company.support_channels"],
        requires_user_confirmation: false,
      }),
    )
  }

  if (hasApprovedProfileDescriptionConflict(snapshot)) {
    gaps.push(
      createGap({
        gap_code: "company_description_conflict",
        severity: "high",
        title: "Company description conflicts with approved profile",
        message:
          `Website company description evidence conflicts with approved profile evidence. ${teammate.name} should ask the operator to resolve this.`,
        related_fields: ["company.company_description"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (fieldHasOnlyWeakWebsiteEvidence(sections.market.geographic_markets)) {
    gaps.push(
      createGap({
        gap_code: "weak_geographic_market_evidence",
        severity: "low",
        title: "Geographic markets inferred from weak evidence",
        message: "Geographic market signals are based only on weak website evidence.",
        related_fields: ["market.geographic_markets"],
        requires_user_confirmation: true,
      }),
    )
  }

  if (confidence_summary.overall_confidence > 0 && confidence_summary.overall_confidence < 0.5) {
    gaps.push(
      createGap({
        gap_code: "low_overall_confidence",
        severity: "medium",
        title: "Overall understanding confidence is low",
        message: `${teammate.name}'s current understanding has low overall confidence and needs operator confirmation.`,
        related_fields: [],
        requires_user_confirmation: true,
      }),
    )
  }

  if (confidence_summary.needs_review_count > 0 || snapshot.contradictions.length > 0) {
    gaps.push(
      createGap({
        gap_code: "needs_review_items_present",
        severity: "high",
        title: "Evidence needs review",
        message: `One or more facts or contradictions require human review before ${teammate.name} acts on this understanding.`,
        related_fields: snapshot.contradictions.map((item) => item.fact_key),
        requires_user_confirmation: true,
      }),
    )
  }

  return gaps
}

export function buildBusinessIntelligenceReport(input: {
  organization_id: string
  evidence_snapshot_id: string
  evidence_run_id: string
  snapshot: EvidenceEngineSnapshotPayload
  generated_at?: string
  metadata?: Record<string, unknown>
  teammateName?: string | null
}): BusinessIntelligenceReport {
  const fieldMap = mapSnapshotToBusinessIntelligenceFields(input.snapshot)
  const sections = buildSections(fieldMap)
  const allFields = collectAllFields(sections)
  const confidence_summary = buildConfidenceSummary({
    snapshot: input.snapshot,
    fields: allFields,
  })
  const gaps = detectBusinessIntelligenceGaps({
    sections,
    snapshot: input.snapshot,
    confidence_summary,
    teammateName: input.teammateName,
  })

  const contradictions: BusinessIntelligenceContradictionSummary[] = input.snapshot.contradictions.map(
    (item) => ({
      fact_key: item.fact_key,
      conflicting_values: [...item.conflicting_values],
      evidence_ids: [...item.evidence_ids],
      severity: item.severity,
      requires_human_review: item.requires_human_review,
    }),
  )

  return {
    organization_id: input.organization_id,
    evidence_snapshot_id: input.evidence_snapshot_id,
    evidence_run_id: input.evidence_run_id,
    generated_at: input.generated_at ?? new Date().toISOString(),
    source_providers: [...input.snapshot.source_providers],
    sections,
    confidence_summary,
    gaps,
    contradictions,
    contradiction_fact_keys: input.snapshot.contradictions.map((item) => item.fact_key),
    ai_recommendations: null,
    ai_recommendations_metadata: { status: "skipped" },
    metadata: input.metadata ?? {},
  }
}
