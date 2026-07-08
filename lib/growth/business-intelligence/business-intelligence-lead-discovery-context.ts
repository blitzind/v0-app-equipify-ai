/** GE-AIOS-8A-8 — Enrich Lead Discovery context with reviewed BI explainability (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { AvaDatamoonAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY,
  type BusinessIntelligenceLeadDiscoveryContextSlice,
  type BusinessIntelligenceLeadDiscoverySignals,
  type LeadDiscoveryExplainabilityLine,
  type LeadDiscoveryExplainabilitySource,
} from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"

const REVIEW_FIELD_TO_EXPLAINABILITY: Record<
  string,
  { id: string; label: string; matchesProjection: (draft: AvaDatamoonAudienceDraft) => boolean }
> = {
  "market.industries_served": {
    id: "bi-industries",
    label: "Industries & topics",
    matchesProjection: (draft) => draft.topics.length > 0,
  },
  "sales.likely_buyer_personas": {
    id: "bi-buyer-roles",
    label: "Buyer roles",
    matchesProjection: (draft) => draft.jobTitles.length > 0,
  },
  "market.geographic_markets": {
    id: "bi-geography",
    label: "Geography",
    matchesProjection: (draft) => Boolean(draft.geography.country),
  },
  "company.company_description": {
    id: "bi-company-description",
    label: "Company understanding",
    matchesProjection: () => true,
  },
  "company.primary_offer": {
    id: "bi-primary-offer",
    label: "Primary offer",
    matchesProjection: () => true,
  },
  "sales.likely_pain_points": {
    id: "bi-pain-points",
    label: "Pain points",
    matchesProjection: () => true,
  },
}

function isBiDerivedDraft(profile: BusinessProfileDraftContent | null): boolean {
  if (!profile) return false
  return profile.confidence.assumptions.some((line) =>
    /business intelligence review/i.test(line),
  )
}

export function buildBusinessIntelligenceLeadDiscoverySignals(input: {
  hasReport: boolean
  hasReviewDecisions: boolean
  latestDraft: { id: string; profile: BusinessProfileDraftContent } | null
  activeApprovedProfileId: string | null
  reviewedFields: BusinessIntelligenceLeadDiscoverySignals["reviewed_fields"]
}): BusinessIntelligenceLeadDiscoverySignals {
  const biDraftPending =
    Boolean(input.latestDraft) &&
    isBiDerivedDraft(input.latestDraft?.profile ?? null) &&
    input.latestDraft?.id !== input.activeApprovedProfileId

  const biAppliedToDraft = biDraftPending

  let advisory: string | null = null
  let suggestionsOnly = false

  if (input.hasReport && !input.hasReviewDecisions && !biAppliedToDraft) {
    advisory = GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY
    suggestionsOnly = true
  } else if (biDraftPending) {
    advisory = GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY
    suggestionsOnly = true
  } else if (input.hasReport && input.hasReviewDecisions && !input.activeApprovedProfileId) {
    advisory = GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY
    suggestionsOnly = true
  }

  return {
    has_report: input.hasReport,
    has_review_decisions: input.hasReviewDecisions,
    bi_draft_pending_approval: biDraftPending,
    bi_draft_profile_id: biDraftPending ? input.latestDraft?.id ?? null : null,
    bi_applied_to_draft: biAppliedToDraft,
    reviewed_fields: input.reviewedFields,
    advisory,
    suggestions_only: suggestionsOnly,
  }
}

function buildBiExplainabilityLines(
  signals: BusinessIntelligenceLeadDiscoverySignals,
  draft: AvaDatamoonAudienceDraft,
): LeadDiscoveryExplainabilityLine[] {
  const lines: LeadDiscoveryExplainabilityLine[] = []

  for (const field of signals.reviewed_fields) {
    if (field.decision !== "approved" && field.decision !== "edited") continue
    const mapping = REVIEW_FIELD_TO_EXPLAINABILITY[field.field_key]
    if (!mapping) continue
    if (!mapping.matchesProjection(draft) && field.field_key.startsWith("market.")) continue

    lines.push({
      id: mapping.id,
      label: mapping.label,
      detail: field.explanation,
      source: "reviewed_business_intelligence" satisfies LeadDiscoveryExplainabilitySource,
      confidence: field.confidence,
      supporting_evidence_ids: field.supporting_evidence_ids,
      explanation: field.explanation,
    })
  }

  return lines
}

export function mergeLeadDiscoveryExplainabilityWithBusinessIntelligence(input: {
  base: LeadDiscoveryExplainabilityLine[]
  signals: BusinessIntelligenceLeadDiscoverySignals | null | undefined
  draft: AvaDatamoonAudienceDraft
}): LeadDiscoveryExplainabilityLine[] {
  if (!input.signals?.has_review_decisions) {
    return input.base
  }

  const biLines = buildBiExplainabilityLines(input.signals, input.draft)
  if (biLines.length === 0) {
    return input.base
  }

  const merged = [...input.base]
  for (const biLine of biLines) {
    const existingIndex = merged.findIndex((line) => line.id === biLine.id)
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex]!,
        detail: `${merged[existingIndex]!.detail} ${biLine.detail}`.trim(),
        source: "reviewed_business_intelligence",
        confidence: biLine.confidence ?? merged[existingIndex]!.confidence ?? null,
        supporting_evidence_ids: [
          ...new Set([
            ...(merged[existingIndex]!.supporting_evidence_ids ?? []),
            ...biLine.supporting_evidence_ids,
          ]),
        ],
        explanation: biLine.explanation,
      }
    } else {
      merged.push(biLine)
    }
  }

  return merged
}

export function enrichLeadDiscoveryContextWithBusinessIntelligence<T extends {
  draft: AvaDatamoonAudienceDraft
  explainability: LeadDiscoveryExplainabilityLine[]
  assumptions: string[]
}>(
  base: T,
  signals: BusinessIntelligenceLeadDiscoverySignals | null | undefined,
): T & { businessIntelligence: BusinessIntelligenceLeadDiscoveryContextSlice } {
  if (!signals) {
    return {
      ...base,
      businessIntelligence: {
        advisory: null,
        pending_draft: false,
        pending_draft_profile_id: null,
        suggestions_only: false,
        review_enriched: false,
      },
    }
  }

  const explainability = mergeLeadDiscoveryExplainabilityWithBusinessIntelligence({
    base: base.explainability,
    signals,
    draft: base.draft,
  })

  const reviewEnriched =
    signals.has_review_decisions &&
    explainability.some((line) => line.source === "reviewed_business_intelligence")

  const businessIntelligence: BusinessIntelligenceLeadDiscoveryContextSlice = {
    advisory: signals.advisory,
    pending_draft: signals.bi_draft_pending_approval,
    pending_draft_profile_id: signals.bi_draft_profile_id,
    suggestions_only: signals.suggestions_only,
    review_enriched: reviewEnriched,
  }

  const assumptions = [...base.assumptions]
  if (signals.advisory) {
    assumptions.push(signals.advisory)
  }
  if (reviewEnriched) {
    assumptions.push(
      "Reviewed Business Intelligence adds explainability only — approved Growth Profile still drives targeting defaults.",
    )
  }

  return {
    ...base,
    explainability,
    assumptions,
    businessIntelligence,
  }
}

export function assertLeadDiscoveryDefaultsUnchangedByUnapprovedBi(input: {
  baselineDraft: AvaDatamoonAudienceDraft
  enrichedDraft: AvaDatamoonAudienceDraft
  signals: BusinessIntelligenceLeadDiscoverySignals | null | undefined
}): boolean {
  if (!input.signals?.suggestions_only) {
    return true
  }
  return JSON.stringify(input.baselineDraft) === JSON.stringify(input.enrichedDraft)
}
