/** GE-AIOS-8A-8 — Read-only BI signals for Lead Discovery context (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildBusinessIntelligenceLeadDiscoverySignals,
  type BusinessIntelligenceLeadDiscoveryReviewField,
} from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context"
import type { BusinessIntelligenceLeadDiscoverySignals } from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-context-types"
import { fetchLatestBusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-repository"
import { fetchBusinessIntelligenceReviewDecisions } from "@/lib/growth/business-intelligence/business-intelligence-review-repository"
import { reviewDecisionLabel } from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import { BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS } from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import {
  getActiveApprovedBusinessProfile,
  getLatestDraftBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-repository"

const REVIEW_FIELD_LABELS: Record<string, string> = {
  "company.company_description": "Company description",
  "company.primary_offer": "Primary offer",
  "company.products": "Products",
  "company.services": "Services",
  "market.industries_served": "Industries served",
  "market.geographic_markets": "Geographic markets",
  "sales.likely_buyer_personas": "Buyer personas",
  "sales.likely_pain_points": "Pain points",
  "company.plans_pricing": "Pricing / plans",
  "company.differentiators": "Differentiators",
}

function mapReviewedFields(
  decisions: Awaited<ReturnType<typeof fetchBusinessIntelligenceReviewDecisions>>,
): BusinessIntelligenceLeadDiscoveryReviewField[] {
  return decisions
    .filter((decision) => BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS.includes(decision.field_key))
    .map((decision) => ({
      field_key: decision.field_key,
      label: REVIEW_FIELD_LABELS[decision.field_key] ?? decision.field_key,
      decision: decision.decision,
      confidence: decision.confidence_at_decision,
      supporting_evidence_ids: [...decision.supporting_evidence_ids],
      explanation: `Reviewed BI field (${reviewDecisionLabel(decision.decision)}): ${REVIEW_FIELD_LABELS[decision.field_key] ?? decision.field_key}.`,
    }))
}

export async function loadBusinessIntelligenceLeadDiscoverySignals(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BusinessIntelligenceLeadDiscoverySignals | null> {
  const [reportRecord, approvedProfile, latestDraft] = await Promise.all([
    fetchLatestBusinessIntelligenceReport(admin, organizationId),
    getActiveApprovedBusinessProfile(admin, organizationId),
    getLatestDraftBusinessProfile(admin, organizationId),
  ])

  if (!reportRecord?.report) {
    return null
  }

  const decisions = await fetchBusinessIntelligenceReviewDecisions(admin, {
    organization_id: organizationId,
    business_intelligence_report_id: reportRecord.report_id,
  })

  return buildBusinessIntelligenceLeadDiscoverySignals({
    hasReport: true,
    hasReviewDecisions: decisions.length > 0,
    latestDraft: latestDraft
      ? { id: latestDraft.id, profile: latestDraft.profile }
      : null,
    activeApprovedProfileId: approvedProfile?.id ?? null,
    reviewedFields: mapReviewedFields(decisions),
  })
}
