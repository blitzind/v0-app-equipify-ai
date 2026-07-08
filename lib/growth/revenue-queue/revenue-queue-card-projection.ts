/** GE-LEADS-CANONICAL-3A — Build inbox-shaped card view from growth.leads (client-safe). */

import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type GrowthLeadInboxCardView,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { GROWTH_OPERATOR_HANDOFF_METADATA_KEY } from "@/lib/growth/operator-handoff/operator-handoff-repository"
import type { GrowthOperatorHandoffOutput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import { computeOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"
import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  deriveCandidateConfidenceFromLead,
  deriveHumanReviewRequiredFromLead,
  deriveIntentScoreFromLead,
  domainFromWebsite,
  mapLeadStatusToInboxQueueStatus,
  mapResearchPriorityToInboxPriority,
  mapWorkflowHealthToPipelineStatus,
  readLeadMetadataSummary,
} from "@/lib/growth/revenue-queue/revenue-queue-inbox-display-map"
import {
  deriveEvidenceStrength,
  normalizeConfidence,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import type { GrowthLead } from "@/lib/growth/types"

function formatTimeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

function isOperatorHandoff(value: unknown): value is { handoff: GrowthOperatorHandoffOutput } {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return row.handoff != null && typeof row.handoff === "object"
}

function buildPseudoInboxRowForHints(lead: GrowthLead, queueStatus: string): GrowthLeadInboxRow {
  const intentScore = deriveIntentScoreFromLead(lead)
  return {
    id: lead.id,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    site_key: lead.sourceDetail ?? lead.sourceKind,
    candidate_type: "identified",
    candidate_priority: mapResearchPriorityToInboxPriority(lead.researchPriority) as GrowthLeadInboxRow["candidate_priority"],
    intent_score: intentScore,
    intent_grade: "F",
    candidate_confidence: deriveCandidateConfidenceFromLead(lead),
    pipeline_entry: "icp_targeting",
    pipeline_status: mapWorkflowHealthToPipelineStatus(lead.workflowHealth, mapLeadStatusToInboxQueueStatus(lead.status)) as GrowthLeadInboxRow["pipeline_status"],
    company_name: lead.companyName,
    domain: domainFromWebsite(lead.website),
    contact_name: lead.contactName,
    email: lead.contactEmail,
    phone: lead.contactPhone,
    linkedin_url: null,
    dedupe_hash: lead.externalRef ?? lead.id,
    candidate_reasoning: lead.notes ? [lead.notes] : [],
    candidate_evidence: [],
    candidate_attribution: lead.sourceChannel
      ? [{ source: lead.sourceChannel, section: "canonical", signal: lead.sourceKind, evidence: lead.sourceDetail ?? "", confidence: 0.5 }]
      : [],
    session_count: typeof lead.metadata.intent_session_count === "number" ? lead.metadata.intent_session_count : 0,
    visit_count: typeof lead.metadata.intent_visit_count === "number" ? lead.metadata.intent_visit_count : 0,
    utm_source: lead.sourceChannel ?? "",
    utm_medium: "",
    utm_campaign: lead.sourceCampaign ?? "",
    owner_id: lead.assignedTo,
    status: queueStatus as GrowthLeadInboxRow["status"],
    human_review_required: deriveHumanReviewRequiredFromLead(lead, mapLeadStatusToInboxQueueStatus(lead.status)),
    lead_engine_run_id: lead.latestResearchRunId,
    intent_session_id: typeof lead.metadata.intent_session_id === "string" ? lead.metadata.intent_session_id : "",
    visitor_key: typeof lead.metadata.visitor_key === "string" ? lead.metadata.visitor_key : "",
    existing_account_match: {
      matched: Boolean(lead.promotedOrganizationId),
      source: lead.promotedOrganizationId ? "growth.leads" : null,
      ids: lead.promotedOrganizationId ? [lead.promotedOrganizationId] : [],
      evidence: "",
    },
    existing_lead_match: { matched: false, source: null, ids: [], evidence: "" },
    metadata: lead.metadata,
  }
}

export function buildOperatorHandoffInputFromGrowthLead(lead: GrowthLead): GrowthOperatorHandoffInput {
  const run = lead.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const outputs = isPipelineRun(run) ? extractLeadEngineOutputsFromRun(run) : {}
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  return {
    leadInbox: buildPseudoInboxRowForHints(lead, queueStatus),
    icpTargeting: outputs.icpTargeting ?? "",
    companyDiscovery: outputs.companyDiscovery ?? "",
    decisionMakerHypothesis: outputs.decisionMakerHypothesis ?? "",
    contactResearch: outputs.contactResearch ?? "",
    verificationTriage: outputs.verificationTriage ?? "",
    accountBrief: outputs.accountBrief ?? "",
    outreachPersonalization: outputs.outreachPersonalization ?? "",
    leadScore: outputs.leadScore ?? "",
    humanApproval: outputs.humanApproval ?? "",
    revenueExecution: outputs.revenueExecution ?? "",
    intentHistory: null,
  }
}

export function buildRevenueQueueCardProjectionFromLead(lead: GrowthLead): GrowthLeadInboxCardView {
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  const pipelineStatus = mapWorkflowHealthToPipelineStatus(lead.workflowHealth, queueStatus)
  const handoffPkg = lead.metadata[GROWTH_OPERATOR_HANDOFF_METADATA_KEY]
  const handoff = isOperatorHandoff(handoffPkg) ? handoffPkg.handoff : null
  const hints = computeOperatorHandoffPriorityHints(buildOperatorHandoffInputFromGrowthLead(lead))
  const run = lead.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const outputs = isPipelineRun(run) ? extractLeadEngineOutputsFromRun(run) : {}
  const verification =
    outputs.verificationTriage && typeof outputs.verificationTriage === "object"
      ? outputs.verificationTriage.disposition
      : "unknown"
  const approval =
    outputs.humanApproval && typeof outputs.humanApproval === "object"
      ? outputs.humanApproval.approval_status
      : deriveHumanReviewRequiredFromLead(lead, queueStatus)
        ? "pending"
        : "n/a"
  const leadScoreValue =
    outputs.leadScore && typeof outputs.leadScore === "object" ? outputs.leadScore.lead_score : null
  const intentScore = deriveIntentScoreFromLead(lead)
  const candidateConfidence = deriveCandidateConfidenceFromLead(lead)
  const candidatePriority = mapResearchPriorityToInboxPriority(lead.researchPriority)
  const humanReviewRequired = deriveHumanReviewRequiredFromLead(lead, queueStatus)

  const searchSummary = readLeadMetadataSummary<{
    top_keyword?: string
    top_category?: string
    signal_count?: number
  }>(lead.metadata, "search_intent_summary")
  const companySummary = readLeadMetadataSummary<{
    company_name?: string
    matched_source?: string
    match_confidence?: number
  }>(lead.metadata, "company_identification_summary")
  const buyingStageSummary = readLeadMetadataSummary<{
    detected_stage?: string
    stage_confidence?: number
  }>(lead.metadata, "buying_stage_summary")
  const buyingStage =
    buyingStageSummary?.detected_stage ??
    (lead.opportunityReadinessTier === "ready" ? "purchase_ready" : null)

  const intentIndicators: string[] = []
  const sessionCount =
    typeof lead.metadata.intent_session_count === "number" ? lead.metadata.intent_session_count : 0
  const visitCount =
    typeof lead.metadata.intent_visit_count === "number" ? lead.metadata.intent_visit_count : 0
  if (sessionCount > 1) intentIndicators.push(`${sessionCount} sessions`)
  if (visitCount > 0) intentIndicators.push(`${visitCount} pageviews`)
  if (lead.sourceCampaign) intentIndicators.push(`Campaign: ${lead.sourceCampaign}`)
  if (lead.promotedOrganizationId) intentIndicators.push("CRM account match")
  if (lead.engagementTopSignals?.length) {
    intentIndicators.push(lead.engagementTopSignals[0]?.label ?? "Engagement signal")
  }
  if (searchSummary?.top_category) {
    intentIndicators.push(`Search: ${String(searchSummary.top_category).replace(/_/g, " ")}`)
  }
  if (searchSummary?.top_keyword) intentIndicators.push(`Keyword: ${searchSummary.top_keyword}`)
  if (companySummary?.company_name) intentIndicators.push(`Company: ${companySummary.company_name}`)
  if (buyingStage) intentIndicators.push(`Stage: ${String(buyingStage).replace(/_/g, " ")}`)

  const decisionMaker =
    outputs.decisionMakerHypothesis && typeof outputs.decisionMakerHypothesis === "object"
      ? outputs.decisionMakerHypothesis
      : null
  const decisionMakerConfidence =
    typeof decisionMaker?.confidence_assessment?.score === "number"
      ? normalizeConfidence(decisionMaker.confidence_assessment.score)
      : lead.decisionMakerStatus === "confirmed"
        ? 0.85
        : lead.decisionMakerStatus === "likely"
          ? 0.65
          : null

  const evidenceCount =
    typeof lead.metadata.evidence_count === "number"
      ? lead.metadata.evidence_count
      : Array.isArray(lead.metadata.candidate_evidence)
        ? lead.metadata.candidate_evidence.length
        : lead.engagementTopSignals?.length ?? 0
  const attributionCount = Array.isArray(lead.metadata.candidate_attribution)
    ? lead.metadata.candidate_attribution.length
    : lead.sourceChannel
      ? 1
      : 0
  const evidenceStrength = deriveEvidenceStrength({
    evidenceCount,
    attributionCount,
    candidateConfidence,
  })

  const isPurchaseReady =
    buyingStage === "purchase_ready" ||
    buyingStage === "active_opportunity" ||
    lead.opportunityReadinessTier === "ready"
  const isHighIntentVisitor =
    intentScore >= 15 ||
    searchSummary?.top_category === "demo_intent" ||
    lead.contactTemperature === "hot"
  const isReturningAccount =
    sessionCount > 1 || Boolean(lead.promotedOrganizationId) || (lead.relationshipStrengthScore ?? 0) >= 50
  const needsReview = humanReviewRequired && (queueStatus === "new" || queueStatus === "reviewing")

  const lastActivityAt =
    lead.engagementLastActivityAt ?? lead.lastHumanTouchAt ?? lead.updatedAt ?? lead.createdAt

  return {
    id: lead.id,
    company_name: lead.companyName || "Unknown company",
    domain: domainFromWebsite(lead.website),
    lead_score: leadScoreValue ?? (intentScore > 0 ? intentScore : null),
    intent_score: intentScore,
    intent_grade: typeof lead.metadata.intent_grade === "string" ? lead.metadata.intent_grade : "F",
    verification_state: verification,
    candidate_type: "identified",
    candidate_priority: candidatePriority,
    recommended_motion: handoff?.recommended_motion ?? hints.recommended_motion,
    recommended_urgency: handoff?.recommended_urgency ?? hints.recommended_urgency,
    recommended_owner: handoff?.recommended_owner ?? hints.recommended_owner,
    human_approval_state: approval,
    owner_id: lead.assignedTo,
    status: queueStatus,
    pipeline_status: pipelineStatus,
    human_review_required: humanReviewRequired,
    session_count: sessionCount,
    visit_count: visitCount,
    candidate_confidence: candidateConfidence,
    last_activity_at: lastActivityAt,
    time_since_activity_label: formatTimeSince(lastActivityAt),
    intent_indicators: intentIndicators,
    has_operator_handoff: handoff != null,
    has_lead_engine_run: isPipelineRun(run),
    buying_stage: buyingStage,
    buying_stage_confidence: buyingStageSummary?.stage_confidence ?? null,
    company_match_confidence: companySummary?.match_confidence ?? null,
    search_intent_category: searchSummary?.top_category ?? null,
    search_intent_keyword: searchSummary?.top_keyword ?? null,
    evidence_strength: evidenceStrength,
    evidence_count: evidenceCount,
    decision_maker_confidence: decisionMakerConfidence,
    is_purchase_ready: isPurchaseReady,
    is_high_intent_visitor: isHighIntentVisitor,
    is_returning_account: isReturningAccount,
    needs_review: needsReview,
  }
}
