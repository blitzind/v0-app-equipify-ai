/** GE-OPPORTUNITY-INTELLIGENCE-1A — Canonical Opportunity Intelligence read model types. Client-safe. */

import type {
  GrowthLeadResearchEvidenceSummary,
  GrowthLeadResearchNextBestAction,
  GrowthLeadResearchOpportunityAssessment,
} from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthNextBestActionResult } from "@/lib/growth/nba-types"
import type { GrowthOpportunitySignal } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { GrowthRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthRevenueTimelineEntry } from "@/lib/growth/revenue-execution/revenue-execution-types"
import type { OpportunityIntelligenceField } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-field"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER =
  "growth-opportunity-intelligence-layer-v1" as const

export const GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY = "prospect_qualification_v1" as const

export type OpportunityIntelligenceLabeledItem = {
  label: string
  source: string
  kind?: string
}

export type OpportunityIntelligenceWorkflowSignalsValue = {
  workflowHealth: GrowthLead["workflowHealth"]
  workflowHealthReason: GrowthLead["workflowHealthReason"]
  workflowHealthComputedAt: GrowthLead["workflowHealthComputedAt"]
  opportunityReadinessTier: GrowthLead["opportunityReadinessTier"]
  opportunityReadinessScore: GrowthLead["opportunityReadinessScore"]
  opportunityReadinessSummary: GrowthLead["opportunityReadinessSummary"]
  opportunityReadinessComputedAt: GrowthLead["opportunityReadinessComputedAt"]
  engagementTier: GrowthLead["engagementTier"]
  relationshipStrengthTier: GrowthLead["relationshipStrengthTier"]
  decisionMakerStatus: GrowthLead["decisionMakerStatus"]
  revenueProbabilityTier: GrowthLead["revenueProbabilityTier"]
  revenueProbabilityScore: GrowthLead["revenueProbabilityScore"]
  executivePriorityTier: GrowthLead["executivePriorityTier"]
  conversationHealthTier: GrowthLead["conversationHealthTier"]
  sequenceFatigueRisk: GrowthLead["sequenceFatigueRisk"]
}

export type OpportunityIntelligenceRecommendationValue = {
  recommendation: string
  recommendationType?: string
  title?: string
  description?: string
  requiresHumanApproval?: boolean
}

export type OpportunityIntelligenceConfidenceValue = {
  confidence: number
  confidenceLabel?: string
  reason?: string
}

export type OpportunityIntelligenceViewModel = {
  qa_marker: typeof GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER
  leadId: string
  organizationId: string
  qualification: OpportunityIntelligenceField<ProspectQualification>
  revenueReadiness: OpportunityIntelligenceField<GrowthRevenueReadinessSnapshot>
  nextBestAction: OpportunityIntelligenceField<
    GrowthNextBestActionResult | GrowthLeadResearchNextBestAction
  >
  opportunityAssessment: OpportunityIntelligenceField<GrowthLeadResearchOpportunityAssessment>
  workflowSignals: OpportunityIntelligenceField<OpportunityIntelligenceWorkflowSignalsValue>
  buyingSignals: OpportunityIntelligenceField<GrowthOpportunitySignal[]>
  evidenceSummary: OpportunityIntelligenceField<GrowthLeadResearchEvidenceSummary>
  recommendation: OpportunityIntelligenceField<OpportunityIntelligenceRecommendationValue>
  confidence: OpportunityIntelligenceField<OpportunityIntelligenceConfidenceValue>
  risks: OpportunityIntelligenceField<OpportunityIntelligenceLabeledItem[]>
  strengths: OpportunityIntelligenceField<OpportunityIntelligenceLabeledItem[]>
  blockers: OpportunityIntelligenceField<OpportunityIntelligenceLabeledItem[]>
  revenueWorkflow: OpportunityIntelligenceField<GrowthRevenueReadinessSnapshot>
  executionTimeline: OpportunityIntelligenceField<GrowthRevenueTimelineEntry[]>
  updatedAt: string
}
