/** GE-AIOS-GROWTH-1A — Growth Lead Research workflow service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent, queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  type GrowthLeadResearchEvidenceSummary,
  type GrowthLeadResearchExecutionPlan,
  type GrowthLeadResearchNextBestAction,
  type GrowthLeadResearchOpportunityAssessment,
  type GrowthLeadResearchQualificationOutput,
  type GrowthLeadResearchWorkflowSnapshot,
  type GrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { isGrowthLeadResearchWorkflowEnabled } from "@/lib/growth/aios/pilot/lead-research-pilot-config"

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

function parseQualification(payload: Record<string, unknown>): GrowthLeadResearchQualificationOutput | null {
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
    ? (record.missing_evidence ?? record.missingEvidence)
        .filter((item): item is string => typeof item === "string")
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

function serializeQualification(qualification: GrowthLeadResearchQualificationOutput) {
  return {
    fit_score: qualification.fitScore,
    recommended_next_action: qualification.recommendedNextAction,
    recommended_work_order_type: qualification.recommendedWorkOrderType,
    confidence: qualification.confidence,
    reason: qualification.reason,
    missing_evidence: qualification.missingEvidence,
  }
}

function serializeOpportunityAssessment(assessment: GrowthLeadResearchOpportunityAssessment) {
  return {
    opportunity_score: assessment.opportunityScore,
    fit_score: assessment.fitScore,
    buying_signal_score: assessment.buyingSignalScore,
    confidence: assessment.confidence,
    estimated_revenue_range: assessment.estimatedRevenueRange,
    estimated_sales_cycle: assessment.estimatedSalesCycle,
    urgency: assessment.urgency,
    effort: assessment.effort,
    roi_estimate: assessment.roiEstimate,
    recommendation: assessment.recommendation,
    worth_pursuing: assessment.worthPursuing,
    summary: assessment.summary,
  }
}

function serializeNextBestAction(action: GrowthLeadResearchNextBestAction) {
  return {
    label: action.label,
    kind: action.kind,
    reason: action.reason,
    priority: action.priority,
    urgency: action.urgency,
  }
}

function serializeEvidenceSummary(summary: GrowthLeadResearchEvidenceSummary) {
  return {
    verified_evidence: summary.verifiedEvidence,
    missing_evidence: summary.missingEvidence,
    potential_risks: summary.potentialRisks,
    assumptions: summary.assumptions,
    human_review_notes: summary.humanReviewNotes,
  }
}

function serializeExecutionPlan(plan: GrowthLeadResearchExecutionPlan) {
  return {
    next_best_action: plan.nextBestAction,
    next_best_action_kind: plan.nextBestActionKind,
    workflow_type: plan.workflowType,
    estimated_steps: plan.estimatedSteps.map((step) => ({
      step_id: step.stepId,
      label: step.label,
      work_order_type: step.workOrderType,
    })),
    required_work_orders: plan.requiredWorkOrders,
    prerequisites: plan.prerequisites,
    required_evidence: plan.requiredEvidence,
    approval_required: plan.approvalRequired,
    estimated_duration: plan.estimatedDuration,
    estimated_cost: plan.estimatedCost,
    expected_outcome: plan.expectedOutcome,
    success_criteria: plan.successCriteria,
    failure_conditions: plan.failureConditions,
    rollback_strategy: plan.rollbackStrategy,
    execution_readiness: plan.executionReadiness,
    missing_prerequisites: plan.missingPrerequisites,
  }
}

function parseExecutionPlan(payload: Record<string, unknown>): GrowthLeadResearchExecutionPlan | null {
  const raw = payload.execution_plan ?? payload.executionPlan
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (typeof record.workflow_type !== "string" && typeof record.workflowType !== "string") return null

  const stepsRaw = record.estimated_steps ?? record.estimatedSteps
  const estimatedSteps = Array.isArray(stepsRaw)
    ? stepsRaw
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const step = item as Record<string, unknown>
          return {
            stepId: String(step.step_id ?? step.stepId ?? "step"),
            label: String(step.label ?? ""),
            workOrderType:
              typeof step.work_order_type === "string"
                ? (step.work_order_type as GrowthLeadResearchExecutionPlan["estimatedSteps"][number]["workOrderType"])
                : typeof step.workOrderType === "string"
                  ? (step.workOrderType as GrowthLeadResearchExecutionPlan["estimatedSteps"][number]["workOrderType"])
                  : null,
          }
        })
    : []

  const readList = (key: string, altKey: string) => {
    const value = record[key] ?? record[altKey]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
  }

  return {
    nextBestAction: String(record.next_best_action ?? record.nextBestAction ?? ""),
    nextBestActionKind: String(
      record.next_best_action_kind ?? record.nextBestActionKind ?? "request_human_review",
    ) as GrowthLeadResearchExecutionPlan["nextBestActionKind"],
    workflowType: String(record.workflow_type ?? record.workflowType) as GrowthLeadResearchExecutionPlan["workflowType"],
    estimatedSteps,
    requiredWorkOrders: readList("required_work_orders", "requiredWorkOrders") as GrowthLeadResearchExecutionPlan["requiredWorkOrders"],
    prerequisites: readList("prerequisites", "prerequisites"),
    requiredEvidence: readList("required_evidence", "requiredEvidence"),
    approvalRequired: Boolean(record.approval_required ?? record.approvalRequired),
    estimatedDuration: String(record.estimated_duration ?? record.estimatedDuration ?? ""),
    estimatedCost: (record.estimated_cost ?? record.estimatedCost ?? "medium") as GrowthLeadResearchExecutionPlan["estimatedCost"],
    expectedOutcome: String(record.expected_outcome ?? record.expectedOutcome ?? ""),
    successCriteria: readList("success_criteria", "successCriteria"),
    failureConditions: readList("failure_conditions", "failureConditions"),
    rollbackStrategy: String(record.rollback_strategy ?? record.rollbackStrategy ?? ""),
    executionReadiness: String(
      record.execution_readiness ?? record.executionReadiness ?? "needs_approval",
    ) as GrowthLeadResearchExecutionPlan["executionReadiness"],
    missingPrerequisites: readList("missing_prerequisites", "missingPrerequisites"),
  }
}

function parseOpportunityAssessment(payload: Record<string, unknown>): GrowthLeadResearchOpportunityAssessment | null {
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

function parseNextBestAction(payload: Record<string, unknown>): GrowthLeadResearchNextBestAction | null {
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

function parseEvidenceSummary(payload: Record<string, unknown>): GrowthLeadResearchEvidenceSummary | null {
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

function parseWorkflowSnapshot(
  event: {
    missionId: string | null
    workOrderId: string | null
    entityId: string | null
    occurredAt: string
    payload: Record<string, unknown> | null
  },
  leadId: string,
): GrowthLeadResearchWorkflowSnapshot | null {
  const payload = event.payload ?? {}
  const workflowStatus = parseWorkflowStatus(payload.workflow_status)
  if (!workflowStatus) return null

  return {
    workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
    workflowStatus,
    leadId,
    missionId: event.missionId,
    workOrderId: event.workOrderId,
    researchRunId: typeof payload.research_run_id === "string" ? payload.research_run_id : null,
    qualification: parseQualification(payload),
    opportunityAssessment: parseOpportunityAssessment(payload),
    nextBestAction: parseNextBestAction(payload),
    evidenceSummary: parseEvidenceSummary(payload),
    executionPlan: parseExecutionPlan(payload),
    updatedAt: event.occurredAt,
  }
}

export async function publishGrowthLeadResearchWorkflowStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    missionId?: string | null
    workOrderId?: string | null
    researchRunId?: string | null
    workflowStatus: GrowthLeadResearchWorkflowStatus
    qualification?: GrowthLeadResearchQualificationOutput | null
    opportunityAssessment?: GrowthLeadResearchOpportunityAssessment | null
    nextBestAction?: GrowthLeadResearchNextBestAction | null
    evidenceSummary?: GrowthLeadResearchEvidenceSummary | null
    executionPlan?: GrowthLeadResearchExecutionPlan | null
    detail?: string | null
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    category: "system",
    producer: "growth_lead_research_workflow",
    source: "growth_lead_research_workflow_service",
    missionId: input.missionId ?? null,
    workOrderId: input.workOrderId ?? null,
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      workflow_key: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
      workflow_status: input.workflowStatus,
      research_run_id: input.researchRunId ?? null,
      detail: input.detail ?? null,
      qualification: input.qualification ? serializeQualification(input.qualification) : null,
      opportunity_assessment: input.opportunityAssessment
        ? serializeOpportunityAssessment(input.opportunityAssessment)
        : null,
      next_best_action: input.nextBestAction ? serializeNextBestAction(input.nextBestAction) : null,
      evidence_summary: input.evidenceSummary ? serializeEvidenceSummary(input.evidenceSummary) : null,
      execution_plan: input.executionPlan ? serializeExecutionPlan(input.executionPlan) : null,
    },
  })
}

export type GrowthLeadResearchWorkflowCommandCenterLead = {
  leadId: string
  companyName: string | null
  workflowStatus: GrowthLeadResearchWorkflowStatus
  fitScore: number | null
  opportunityScore: number | null
  recommendation: string | null
  estimatedRevenueRange: string | null
  confidence: number | null
  risk: string | null
  nextBestAction: string | null
  priority: string | null
  workflowType: string | null
  executionReadiness: string | null
  missingPrerequisites: string[]
  estimatedDuration: string | null
  estimatedCost: string | null
  approvalRequired: boolean | null
  recommendedNextAction: string | null
  recommendedWorkOrderType: GrowthLeadResearchQualificationOutput["recommendedWorkOrderType"]
  observationHref: string
  leadsHref: string
  updatedAt: string
}

export type GrowthLeadResearchWorkflowCommandCenterSummary = {
  workflowKey: typeof GROWTH_LEAD_RESEARCH_WORKFLOW_KEY
  featureEnabled: boolean
  statusCounts: Record<GrowthLeadResearchWorkflowStatus, number>
  activeLeads: GrowthLeadResearchWorkflowCommandCenterLead[]
  assessedLeads: GrowthLeadResearchWorkflowCommandCenterLead[]
  qualifiedLeads: GrowthLeadResearchWorkflowCommandCenterLead[]
  blockedLeads: GrowthLeadResearchWorkflowCommandCenterLead[]
  recommendedNextActions: Array<{
    leadId: string
    companyName: string | null
    action: string
    workOrderType: GrowthLeadResearchQualificationOutput["recommendedWorkOrderType"]
    reason: string
    priority: string | null
    observationHref: string
  }>
}

function emptyStatusCounts(): Record<GrowthLeadResearchWorkflowStatus, number> {
  return {
    not_started: 0,
    scheduled: 0,
    researching: 0,
    research_complete: 0,
    qualified: 0,
    assessed: 0,
    blocked: 0,
    failed: 0,
  }
}

export async function buildGrowthLeadResearchWorkflowCommandCenterSummary(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLeadResearchWorkflowCommandCenterSummary> {
  const limit = input.limit ?? 24
  const featureEnabled = isGrowthLeadResearchWorkflowEnabled()

  if (!featureEnabled) {
    return {
      workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
      featureEnabled: false,
      statusCounts: emptyStatusCounts(),
      activeLeads: [],
      assessedLeads: [],
      qualifiedLeads: [],
      blockedLeads: [],
      recommendedNextActions: [],
    }
  }

  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    limit: 200,
  })

  const latestByLead = new Map<string, GrowthLeadResearchWorkflowSnapshot>()

  for (const event of events) {
    const payload = event.payload ?? {}
    if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) continue
    const leadId = event.entityId ?? (typeof payload.lead_id === "string" ? payload.lead_id : null)
    if (!leadId) continue
    if (latestByLead.has(leadId)) continue

    const workflowStatus = parseWorkflowStatus(payload.workflow_status)
    if (!workflowStatus) continue

    const snapshot = parseWorkflowSnapshot(event, leadId)
    if (!snapshot) continue
    latestByLead.set(leadId, snapshot)
  }

  const snapshots = [...latestByLead.values()].slice(0, limit)
  const statusCounts = emptyStatusCounts()
  for (const snapshot of snapshots) {
    statusCounts[snapshot.workflowStatus] += 1
  }

  const leads: GrowthLeadResearchWorkflowCommandCenterLead[] = []
  for (const snapshot of snapshots) {
    const lead = await fetchGrowthLeadById(admin, snapshot.leadId)
    const observationHref = buildAiOsPilotLeadResearchHref(snapshot.leadId) ?? `/growth/os/pilot/lead-research/${snapshot.leadId}`
    leads.push({
      leadId: snapshot.leadId,
      companyName: lead?.companyName ?? null,
      workflowStatus: snapshot.workflowStatus,
      fitScore: snapshot.qualification?.fitScore ?? snapshot.opportunityAssessment?.fitScore ?? null,
      opportunityScore: snapshot.opportunityAssessment?.opportunityScore ?? null,
      recommendation: snapshot.opportunityAssessment?.recommendation ?? null,
      estimatedRevenueRange: snapshot.opportunityAssessment?.estimatedRevenueRange ?? null,
      confidence: snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null,
      risk: snapshot.evidenceSummary?.potentialRisks[0] ?? null,
      nextBestAction: snapshot.nextBestAction?.label ?? snapshot.executionPlan?.nextBestAction ?? null,
      priority: snapshot.nextBestAction?.priority ?? null,
      workflowType: snapshot.executionPlan?.workflowType ?? null,
      executionReadiness: snapshot.executionPlan?.executionReadiness ?? null,
      missingPrerequisites: snapshot.executionPlan?.missingPrerequisites ?? [],
      estimatedDuration: snapshot.executionPlan?.estimatedDuration ?? null,
      estimatedCost: snapshot.executionPlan?.estimatedCost ?? null,
      approvalRequired: snapshot.executionPlan?.approvalRequired ?? null,
      recommendedNextAction: snapshot.qualification?.recommendedNextAction ?? null,
      recommendedWorkOrderType: snapshot.qualification?.recommendedWorkOrderType ?? null,
      observationHref,
      leadsHref: `/growth/leads/${snapshot.leadId}`,
      updatedAt: snapshot.updatedAt ?? new Date(0).toISOString(),
    })
  }

  leads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  const activeLeads = leads.filter((lead) =>
    ["scheduled", "researching", "research_complete"].includes(lead.workflowStatus),
  )
  const assessedLeads = leads.filter((lead) => lead.workflowStatus === "assessed")
  const qualifiedLeads = leads.filter((lead) =>
    lead.workflowStatus === "qualified" || lead.workflowStatus === "assessed",
  )
  const blockedLeads = leads.filter((lead) =>
    ["blocked", "failed"].includes(lead.workflowStatus),
  )

  const recommendedNextActions = assessedLeads
    .filter((lead) => lead.nextBestAction)
    .map((lead) => ({
      leadId: lead.leadId,
      companyName: lead.companyName,
      action: lead.nextBestAction ?? "",
      workOrderType: lead.recommendedWorkOrderType,
      reason:
        snapshots.find((snapshot) => snapshot.leadId === lead.leadId)?.nextBestAction?.reason ??
        snapshots.find((snapshot) => snapshot.leadId === lead.leadId)?.opportunityAssessment?.summary ??
        "",
      priority: lead.priority,
      observationHref: lead.observationHref,
    }))
    .slice(0, 8)

  return {
    workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
    featureEnabled,
    statusCounts,
    activeLeads: activeLeads.slice(0, 8),
    assessedLeads: assessedLeads.slice(0, 8),
    qualifiedLeads: qualifiedLeads.slice(0, 8),
    blockedLeads: blockedLeads.slice(0, 8),
    recommendedNextActions,
  }
}

export async function fetchLatestGrowthLeadResearchWorkflowSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthLeadResearchWorkflowSnapshot | null> {
  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    correlationId: input.leadId,
    limit: 100,
  })

  for (const event of events) {
    if (event.eventType !== GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT) continue
    const payload = event.payload ?? {}
    if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) continue

    const workflowStatus = parseWorkflowStatus(payload.workflow_status)
    if (!workflowStatus) continue

    return parseWorkflowSnapshot(event, input.leadId)
  }

  return null
}
