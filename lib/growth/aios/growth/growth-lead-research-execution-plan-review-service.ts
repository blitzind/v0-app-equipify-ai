/** GE-AIOS-GROWTH-1D — Execution Plan Approval Queue service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent, queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  buildGrowthLeadResearchExecutionPlanId,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
  mapExecutionPlanReviewActionToStatus,
  resolveEffectiveExecutionPlanApprovalStatus,
  type GrowthLeadResearchExecutionPlanQueueItem,
  type GrowthLeadResearchExecutionPlanReviewAction,
  type GrowthLeadResearchExecutionPlanReviewRecord,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { isGrowthLeadResearchWorkflowEnabled } from "@/lib/growth/aios/pilot/lead-research-pilot-config"

function parseReviewRecord(payload: Record<string, unknown>): GrowthLeadResearchExecutionPlanReviewRecord | null {
  const planId = typeof payload.plan_id === "string" ? payload.plan_id : null
  const leadId = typeof payload.lead_id === "string" ? payload.lead_id : null
  const approvalStatus = typeof payload.approval_status === "string" ? payload.approval_status : null
  const action = typeof payload.review_action === "string" ? payload.review_action : null
  const operatorUserId = typeof payload.operator_user_id === "string" ? payload.operator_user_id : null
  const reviewedAt = typeof payload.reviewed_at === "string" ? payload.reviewed_at : null

  if (!planId || !leadId || !approvalStatus || !action || !operatorUserId || !reviewedAt) return null

  return {
    planId,
    leadId,
    approvalStatus: approvalStatus as GrowthLeadResearchExecutionPlanReviewRecord["approvalStatus"],
    action: action as GrowthLeadResearchExecutionPlanReviewRecord["action"],
    operatorUserId,
    note: typeof payload.note === "string" ? payload.note : null,
    reviewedAt,
  }
}

export async function fetchLatestExecutionPlanReviewForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthLeadResearchExecutionPlanReviewRecord | null> {
  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
    correlationId: input.leadId,
    limit: 20,
  })

  for (const event of events) {
    const record = parseReviewRecord(event.payload ?? {})
    if (record?.leadId === input.leadId) return record
  }

  return null
}

async function listLatestExecutionPlanReviews(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<Map<string, GrowthLeadResearchExecutionPlanReviewRecord>> {
  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
    limit: 200,
  })

  const latestByLead = new Map<string, GrowthLeadResearchExecutionPlanReviewRecord>()
  for (const event of events) {
    const record = parseReviewRecord(event.payload ?? {})
    if (!record) continue
    if (latestByLead.has(record.leadId)) continue
    latestByLead.set(record.leadId, record)
  }

  return latestByLead
}

export async function buildGrowthLeadResearchExecutionPlanApprovalQueue(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLeadResearchExecutionPlanQueueItem[]> {
  const limit = input.limit ?? 24

  if (!isGrowthLeadResearchWorkflowEnabled()) {
    return []
  }

  const workflowEvents = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    limit: 200,
  })

  const latestByLead = new Map<string, { leadId: string; updatedAt: string; hasPlan: boolean }>()

  for (const event of workflowEvents) {
    const payload = event.payload ?? {}
    if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) continue
    if (payload.workflow_status !== "assessed") continue
    const leadId = event.entityId ?? (typeof payload.lead_id === "string" ? payload.lead_id : null)
    if (!leadId) continue
    if (latestByLead.has(leadId)) continue
    if (!payload.execution_plan && !payload.executionPlan) continue

    latestByLead.set(leadId, {
      leadId,
      updatedAt: event.occurredAt,
      hasPlan: true,
    })
  }

  const reviews = await listLatestExecutionPlanReviews(admin, { organizationId: input.organizationId })
  const queue: GrowthLeadResearchExecutionPlanQueueItem[] = []

  for (const entry of [...latestByLead.values()].slice(0, limit)) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId: entry.leadId,
    })
    if (!snapshot?.executionPlan || snapshot.workflowStatus !== "assessed") continue

    const plan = snapshot.executionPlan
    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId: entry.leadId, plan })
    const review = reviews.get(entry.leadId) ?? null
    const approvalStatus = resolveEffectiveExecutionPlanApprovalStatus({ plan, review, planId })
    const lead = await fetchGrowthLeadById(admin, entry.leadId)

    queue.push({
      planId,
      leadId: entry.leadId,
      companyName: lead?.companyName ?? null,
      recommendedWorkflow: plan.workflowType,
      readinessStatus: plan.executionReadiness,
      approvalStatus,
      approvalRequired: plan.approvalRequired,
      missingPrerequisites: plan.missingPrerequisites,
      estimatedDuration: plan.estimatedDuration,
      estimatedCost: plan.estimatedCost,
      confidence: snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null,
      reason:
        snapshot.nextBestAction?.reason ??
        snapshot.opportunityAssessment?.summary ??
        plan.expectedOutcome,
      createdAt: snapshot.updatedAt ?? entry.updatedAt,
      reviewUpdatedAt: review?.reviewedAt ?? null,
      reviewedByUserId: review?.operatorUserId ?? null,
      observationHref:
        buildAiOsPilotLeadResearchHref(entry.leadId) ?? `/growth/os/pilot/lead-research/${entry.leadId}`,
    })
  }

  queue.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  return queue
}

export async function submitGrowthLeadResearchExecutionPlanReviewAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    planId: string
    action: GrowthLeadResearchExecutionPlanReviewAction
    operatorUserId: string
    note?: string | null
    source?: string
  },
): Promise<GrowthLeadResearchExecutionPlanReviewRecord> {
  if (!isGrowthLeadResearchWorkflowEnabled()) {
    throw new Error("growth_lead_research_workflow_disabled")
  }

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot?.executionPlan || snapshot.workflowStatus !== "assessed") {
    throw new Error("execution_plan_not_found")
  }

  const currentPlanId = buildGrowthLeadResearchExecutionPlanId({
    leadId: input.leadId,
    plan: snapshot.executionPlan,
  })

  if (currentPlanId !== input.planId) {
    throw new Error("execution_plan_id_mismatch")
  }

  const approvalStatus = mapExecutionPlanReviewActionToStatus(input.action)
  const reviewedAt = new Date().toISOString()

  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
    category: "approval",
    producer: "growth_lead_research_execution_plan_review",
    source: input.source ?? "growth_lead_research_execution_plan_review_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      plan_id: input.planId,
      lead_id: input.leadId,
      workflow_type: snapshot.executionPlan.workflowType,
      approval_status: approvalStatus,
      review_action: input.action,
      operator_user_id: input.operatorUserId,
      note: input.note ?? null,
      reviewed_at: reviewedAt,
      planning_only: true,
    },
  })

  return {
    planId: input.planId,
    leadId: input.leadId,
    approvalStatus,
    action: input.action,
    operatorUserId: input.operatorUserId,
    note: input.note ?? null,
    reviewedAt,
  }
}
