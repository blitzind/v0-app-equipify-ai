/** GE-LEADS-CANONICAL-3A — Full canonical Revenue Queue projection from growth.leads (client-safe). */

import { buildRevenueQueueCardProjectionFromLead } from "@/lib/growth/revenue-queue/revenue-queue-card-projection"
import {
  mapLeadStatusToInboxQueueStatus,
  mapResearchPriorityToInboxPriority,
  mapWorkflowHealthToPipelineStatus,
  readLeadMetadataSummary,
} from "@/lib/growth/revenue-queue/revenue-queue-inbox-display-map"
import {
  GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER,
  type RevenueQueueLeadProjection,
} from "@/lib/growth/revenue-queue/revenue-queue-projection-types"
import type { GrowthLead } from "@/lib/growth/types"

function collectMissingProjectionFields(lead: GrowthLead): string[] {
  const missing: string[] = []
  const sessionCount =
    typeof lead.metadata.intent_session_count === "number" ? lead.metadata.intent_session_count : null
  const visitCount =
    typeof lead.metadata.intent_visit_count === "number" ? lead.metadata.intent_visit_count : null
  if (sessionCount == null && visitCount == null && lead.sourceKind === "website") {
    missing.push("intent_session_count")
    missing.push("intent_visit_count")
  }
  if (!readLeadMetadataSummary(lead.metadata, "buying_stage_summary") && !lead.opportunityReadinessTier) {
    missing.push("buying_stage_summary")
  }
  if (!readLeadMetadataSummary(lead.metadata, "search_intent_summary")) {
    missing.push("search_intent_summary")
  }
  if (!readLeadMetadataSummary(lead.metadata, "company_identification_summary")) {
    missing.push("company_identification_summary")
  }
  return missing
}

export function buildRevenueQueueLeadProjection(lead: GrowthLead): RevenueQueueLeadProjection {
  const card = buildRevenueQueueCardProjectionFromLead(lead)
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  const pipelineStatus = mapWorkflowHealthToPipelineStatus(lead.workflowHealth, queueStatus)
  const buyingStageSummary = readLeadMetadataSummary<{ detected_stage?: string; stage_confidence?: number }>(
    lead.metadata,
    "buying_stage_summary",
  )

  return {
    qa_marker: GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER,
    growth_lead_id: lead.id,
    company_name: lead.companyName,
    domain: card.domain,
    contact_name: lead.contactName,
    contact_email: lead.contactEmail,
    contact_phone: lead.contactPhone,
    source_kind: lead.sourceKind,
    source_channel: lead.sourceChannel,
    source_campaign: lead.sourceCampaign,
    lead_status: lead.status,
    queue_display_status: queueStatus,
    queue_display_pipeline_status: pipelineStatus,
    priority: mapResearchPriorityToInboxPriority(lead.researchPriority),
    confidence: card.candidate_confidence,
    intent_score: card.intent_score,
    lead_score: card.lead_score,
    next_best_action: lead.nextBestAction,
    next_best_action_reason: lead.nextBestActionReason,
    workflow_stage: lead.status,
    workflow_health: lead.workflowHealth,
    assignment_owner_id: lead.assignedTo,
    recommended_owner: card.recommended_owner,
    recommended_motion: card.recommended_motion,
    recommended_urgency: card.recommended_urgency,
    communication_health_tier: lead.conversationHealthTier,
    communication_health_score: lead.conversationHealthScore,
    research_completion: {
      latest_research_run_id: lead.latestResearchRunId,
      last_researched_at: lead.lastResearchedAt,
      has_lead_engine_run: card.has_lead_engine_run,
    },
    buying_committee_status: lead.decisionMakerStatus,
    decision_maker_confidence: card.decision_maker_confidence,
    sequence_state: {
      active_enrollment_id: lead.activeSequenceEnrollmentId,
      recommended_pattern_id: lead.recommendedSequencePatternId,
      recommended_next_step:
        typeof lead.recommendedSequenceNextStep === "object" &&
        lead.recommendedSequenceNextStep &&
        "action" in lead.recommendedSequenceNextStep
          ? String((lead.recommendedSequenceNextStep as { action?: string }).action ?? "")
          : null,
      fatigue_risk: lead.sequenceFatigueRisk,
    },
    buying_stage: card.buying_stage,
    buying_stage_confidence: buyingStageSummary?.stage_confidence ?? null,
    last_activity_at: card.last_activity_at,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    human_review_required: card.human_review_required,
    evidence_strength: card.evidence_strength,
    evidence_count: card.evidence_count,
    intent_indicators: card.intent_indicators,
    is_purchase_ready: card.is_purchase_ready,
    is_high_intent_visitor: card.is_high_intent_visitor,
    is_returning_account: card.is_returning_account,
    needs_review: card.needs_review,
    card_view: card,
    missing_projection_fields: collectMissingProjectionFields(lead),
  }
}

export function buildRevenueQueueLeadProjections(leads: GrowthLead[]): RevenueQueueLeadProjection[] {
  return leads.map(buildRevenueQueueLeadProjection)
}
