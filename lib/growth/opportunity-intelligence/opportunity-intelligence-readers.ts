/** GE-OPPORTUNITY-INTELLIGENCE-1A — Read persisted intelligence without invoking engines. Client-safe. */

import type { GrowthLeadResearchEvidenceSummary } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type {
  GrowthLeadResearchNextBestAction,
  GrowthLeadResearchOpportunityAssessment,
} from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  type GrowthLeadResearchWorkflowSnapshot,
  type GrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import { GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY } from "@/lib/growth/revenue-execution/revenue-execution-types"
import type { GrowthRevenueTimelineEntry } from "@/lib/growth/revenue-execution/revenue-execution-types"
import {
  GROWTH_REVENUE_WORKFLOW_METADATA_KEY,
  type GrowthRevenueReadinessSnapshot,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import {
  GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY,
  type OpportunityIntelligenceWorkflowSignalsValue,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"
import type { GrowthLead } from "@/lib/growth/types"
import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"

export {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY,
}

function parseWorkflowStatus(value: unknown): GrowthLeadResearchWorkflowStatus | null {
  if (typeof value !== "string") return null
  const statuses = [
    "not_started",
    "scheduled",
    "researching",
    "research_complete",
    "qualified",
    "assessed",
    "blocked",
    "failed",
  ] as const
  return (statuses as readonly string[]).includes(value) ? (value as GrowthLeadResearchWorkflowStatus) : null
}

function parseResearchQualification(payload: Record<string, unknown>): GrowthLeadResearchQualificationOutput | null {
  const raw = payload.qualification
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.fit_score !== "number" && typeof record.fitScore !== "number") return null
  if (typeof record.recommended_next_action !== "string" && typeof record.recommendedNextAction !== "string") {
    return null
  }
  if (typeof record.confidence !== "number") return null
  if (typeof record.reason !== "string") return null

  const missingEvidence = Array.isArray(record.missing_evidence ?? record.missingEvidence)
    ? (record.missing_evidence ?? record.missingEvidence).filter((item): item is string => typeof item === "string")
    : []

  const recommendedWorkOrderType =
    typeof record.recommended_work_order_type === "string"
      ? record.recommended_work_order_type
      : typeof record.recommendedWorkOrderType === "string"
        ? record.recommendedWorkOrderType
        : null

  return {
    fitScore: Number(record.fit_score ?? record.fitScore),
    recommendedNextAction: String(record.recommended_next_action ?? record.recommendedNextAction),
    recommendedWorkOrderType: recommendedWorkOrderType as GrowthLeadResearchQualificationOutput["recommendedWorkOrderType"],
    confidence: record.confidence,
    reason: record.reason,
    missingEvidence,
  }
}

export function parsePersistedOpportunityAssessment(
  payload: Record<string, unknown>,
): GrowthLeadResearchOpportunityAssessment | null {
  const raw = payload.opportunity_assessment ?? payload.opportunityAssessment
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.opportunity_score !== "number" && typeof record.opportunityScore !== "number") return null
  if (typeof record.recommendation !== "string") return null
  return {
    opportunityScore: Number(record.opportunity_score ?? record.opportunityScore),
    fitScore: Number(record.fit_score ?? record.fitScore ?? 0),
    buyingSignalScore: Number(record.buying_signal_score ?? record.buyingSignalScore ?? 0),
    confidence: Number(record.confidence ?? 0),
    estimatedRevenueRange: String(record.estimated_revenue_range ?? record.estimatedRevenueRange ?? ""),
    estimatedSalesCycle: String(record.estimated_sales_cycle ?? record.estimatedSalesCycle ?? ""),
    urgency: (record.urgency as GrowthLeadResearchOpportunityAssessment["urgency"]) ?? "medium",
    effort: (record.effort as GrowthLeadResearchOpportunityAssessment["effort"]) ?? "medium",
    roiEstimate: (record.roi_estimate as GrowthLeadResearchOpportunityAssessment["roiEstimate"]) ?? "medium",
    recommendation: record.recommendation as GrowthLeadResearchOpportunityAssessment["recommendation"],
    worthPursuing: Boolean(record.worth_pursuing ?? record.worthPursuing),
    summary: String(record.summary ?? ""),
  }
}

export function parsePersistedResearchNextBestAction(
  payload: Record<string, unknown>,
): GrowthLeadResearchNextBestAction | null {
  const raw = payload.next_best_action ?? payload.nextBestAction
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.label !== "string" || typeof record.kind !== "string") return null
  return {
    label: record.label,
    kind: record.kind as GrowthLeadResearchNextBestAction["kind"],
    reason: String(record.reason ?? ""),
    priority: (record.priority as GrowthLeadResearchNextBestAction["priority"]) ?? "medium",
    urgency: (record.urgency as GrowthLeadResearchNextBestAction["urgency"]) ?? "medium",
  }
}

export function parsePersistedEvidenceSummary(payload: Record<string, unknown>): GrowthLeadResearchEvidenceSummary | null {
  const raw = payload.evidence_summary ?? payload.evidenceSummary
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const readList = (key: string) =>
    Array.isArray(record[key]) ? record[key].filter((item): item is string => typeof item === "string") : []
  return {
    verifiedEvidence: readList("verified_evidence").length ? readList("verified_evidence") : readList("verifiedEvidence"),
    missingEvidence: readList("missing_evidence").length ? readList("missing_evidence") : readList("missingEvidence"),
    potentialRisks: readList("potential_risks").length ? readList("potential_risks") : readList("potentialRisks"),
    assumptions: readList("assumptions"),
    humanReviewNotes: readList("human_review_notes").length ? readList("human_review_notes") : readList("humanReviewNotes"),
  }
}

export function parseGrowthLeadResearchWorkflowSnapshotFromEvent(input: {
  leadId: string
  occurredAt: string
  missionId: string | null
  workOrderId: string | null
  payload: Record<string, unknown> | null
}): GrowthLeadResearchWorkflowSnapshot | null {
  const payload = input.payload ?? {}
  if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) return null
  const workflowStatus = parseWorkflowStatus(payload.workflow_status)
  if (!workflowStatus) return null

  return {
    workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
    workflowStatus,
    leadId: input.leadId,
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    researchRunId: typeof payload.research_run_id === "string" ? payload.research_run_id : null,
    qualification: parseResearchQualification(payload),
    opportunityAssessment: parsePersistedOpportunityAssessment(payload),
    nextBestAction: parsePersistedResearchNextBestAction(payload),
    evidenceSummary: parsePersistedEvidenceSummary(payload),
    executionPlan: null,
    updatedAt: input.occurredAt,
  }
}

export function readProspectQualificationFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ProspectQualification | null {
  const raw = metadata?.[GROWTH_PROSPECT_QUALIFICATION_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Partial<ProspectQualification>
  if (record.version !== 1) return null
  if (typeof record.overallScore !== "number" || typeof record.generatedAt !== "string") return null
  if (!record.acquisitionCandidate || typeof record.acquisitionCandidate !== "object") return null
  return record as ProspectQualification
}

export function readRevenueReadinessSnapshotFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthRevenueReadinessSnapshot | null {
  const raw = metadata?.[GROWTH_REVENUE_WORKFLOW_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const snapshot = raw as Partial<GrowthRevenueReadinessSnapshot>
  if (typeof snapshot.score !== "number" || !snapshot.tier) return null
  return snapshot as GrowthRevenueReadinessSnapshot
}

export function readRevenueExecutionTimelineFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthRevenueTimelineEntry[] {
  const raw = metadata?.[GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY]
  if (!Array.isArray(raw)) return []
  return raw.filter((entry) => entry && typeof entry === "object") as GrowthRevenueTimelineEntry[]
}

export function readLeadNextBestActionFromLead(lead: GrowthLead): {
  action: GrowthNextBestAction | null
  reason: string | null
  computedAt: string | null
  label: string | null
} {
  const action = lead.nextBestAction
  return {
    action,
    reason: lead.nextBestActionReason,
    computedAt: lead.nextBestActionComputedAt,
    label: action ? GROWTH_NEXT_BEST_ACTION_LABELS[action] : null,
  }
}

export function readWorkflowSignalsFromLead(lead: GrowthLead): OpportunityIntelligenceWorkflowSignalsValue {
  return {
    workflowHealth: lead.workflowHealth,
    workflowHealthReason: lead.workflowHealthReason,
    workflowHealthComputedAt: lead.workflowHealthComputedAt,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    opportunityReadinessSummary: lead.opportunityReadinessSummary,
    opportunityReadinessComputedAt: lead.opportunityReadinessComputedAt,
    engagementTier: lead.engagementTier,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    decisionMakerStatus: lead.decisionMakerStatus,
    revenueProbabilityTier: lead.revenueProbabilityTier,
    revenueProbabilityScore: lead.revenueProbabilityScore,
    executivePriorityTier: lead.executivePriorityTier,
    conversationHealthTier: lead.conversationHealthTier,
    sequenceFatigueRisk: lead.sequenceFatigueRisk,
  }
}

export function workflowSignalsComputedAt(lead: GrowthLead): string | null {
  const timestamps = [
    lead.workflowHealthComputedAt,
    lead.opportunityReadinessComputedAt,
    lead.engagementComputedAt,
    lead.relationshipComputedAt,
    lead.revenueForecastComputedAt,
    lead.executiveOperatingComputedAt,
    lead.conversationComputedAt,
    lead.recommendedSequenceComputedAt,
  ].filter((value): value is string => typeof value === "string" && value.length > 0)

  if (timestamps.length === 0) return null
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
}

export function hasAnyWorkflowSignal(value: OpportunityIntelligenceWorkflowSignalsValue): boolean {
  return (
    value.workflowHealth != null ||
    value.opportunityReadinessTier != null ||
    value.opportunityReadinessScore != null ||
    value.engagementTier != null ||
    value.relationshipStrengthTier != null ||
    value.decisionMakerStatus != null ||
    value.revenueProbabilityTier != null ||
    value.executivePriorityTier != null ||
    value.conversationHealthTier != null ||
    value.sequenceFatigueRisk != null
  )
}
