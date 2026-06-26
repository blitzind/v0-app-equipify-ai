/** GE-AIOS-GROWTH-1E — Approved Plan Readiness & Audit Trail service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import {
  buildGrowthLeadResearchExecutionPlanId,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
  resolveEffectiveExecutionPlanApprovalStatus,
  type GrowthLeadResearchExecutionPlanReviewRecord,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { fetchLatestExecutionPlanReviewForLead } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  resolveApprovedPlanReadinessReason,
  resolveApprovedPlanReadinessState,
  resolveFutureExecutionSummary,
  type GrowthLeadResearchApprovedPlanReadinessItem,
  type GrowthLeadResearchExecutionPlanAuditTrail,
  type GrowthLeadResearchExecutionPlanAuditTrailEntry,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
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

function workflowEventSummary(payload: Record<string, unknown>): { summary: string; detail: string | null } {
  const status = typeof payload.workflow_status === "string" ? payload.workflow_status : "unknown"
  const hasPlan = Boolean(payload.execution_plan ?? payload.executionPlan)
  const detail = typeof payload.detail === "string" ? payload.detail : null

  if (status === "assessed" && hasPlan) {
    const workflowType =
      typeof (payload.execution_plan as Record<string, unknown> | undefined)?.workflow_type === "string"
        ? String((payload.execution_plan as Record<string, unknown>).workflow_type)
        : null
    return {
      summary: `Opportunity assessed — execution plan attached${workflowType ? ` (${workflowType.replaceAll("_", " ")})` : ""}`,
      detail,
    }
  }

  if (status === "qualified") {
    return { summary: "Lead qualified after research", detail }
  }

  return {
    summary: `Workflow status: ${status.replaceAll("_", " ")}`,
    detail,
  }
}

function reviewEventSummary(record: GrowthLeadResearchExecutionPlanReviewRecord): { summary: string; detail: string | null } {
  return {
    summary: `Operator review: ${record.action.replaceAll("_", " ")} → ${record.approvalStatus.replaceAll("_", " ")}`,
    detail: record.note,
  }
}

export async function buildGrowthLeadResearchExecutionPlanAuditTrail(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; planId: string },
): Promise<GrowthLeadResearchExecutionPlanAuditTrail> {
  const [workflowEvents, reviewEvents] = await Promise.all([
    queryAiOsEvents(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
      correlationId: input.leadId,
      limit: 100,
    }),
    queryAiOsEvents(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT,
      correlationId: input.leadId,
      limit: 50,
    }),
  ])

  const entries: GrowthLeadResearchExecutionPlanAuditTrailEntry[] = []

  for (const event of workflowEvents) {
    const payload = event.payload ?? {}
    if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) continue
    const status = payload.workflow_status
    if (status !== "assessed" && status !== "qualified") continue

    const { summary, detail } = workflowEventSummary(payload)
    entries.push({
      eventId: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      summary,
      detail,
    })
  }

  for (const event of reviewEvents) {
    const record = parseReviewRecord(event.payload ?? {})
    if (!record || record.leadId !== input.leadId) continue
    const { summary, detail } = reviewEventSummary(record)
    entries.push({
      eventId: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      summary,
      detail,
    })
  }

  entries.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))

  return {
    leadId: input.leadId,
    planId: input.planId,
    entries,
  }
}

export async function buildGrowthLeadResearchApprovedPlanReadinessQueue(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLeadResearchApprovedPlanReadinessItem[]> {
  const limit = input.limit ?? 24

  if (!isGrowthLeadResearchWorkflowEnabled()) {
    return []
  }

  const workflowEvents = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    limit: 200,
  })

  const assessedLeadIds: string[] = []
  for (const event of workflowEvents) {
    const payload = event.payload ?? {}
    if (payload.workflow_key !== GROWTH_LEAD_RESEARCH_WORKFLOW_KEY) continue
    if (payload.workflow_status !== "assessed") continue
    const leadId = event.entityId ?? (typeof payload.lead_id === "string" ? payload.lead_id : null)
    if (!leadId || assessedLeadIds.includes(leadId)) continue
    if (!payload.execution_plan && !payload.executionPlan) continue
    assessedLeadIds.push(leadId)
  }

  const items: GrowthLeadResearchApprovedPlanReadinessItem[] = []

  for (const leadId of assessedLeadIds.slice(0, limit)) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId,
    })
    if (!snapshot?.executionPlan || snapshot.workflowStatus !== "assessed") continue

    const plan = snapshot.executionPlan
    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId, plan })
    const review = await fetchLatestExecutionPlanReviewForLead(admin, {
      organizationId: input.organizationId,
      leadId,
    })
    const approvalState = resolveEffectiveExecutionPlanApprovalStatus({ plan, review, planId })

    if (approvalState !== "approved_for_future_execution") continue

    const confidence = snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null
    const readinessState = resolveApprovedPlanReadinessState({
      plan,
      approvalStatus: approvalState,
      confidence,
    })
    const readinessReason = resolveApprovedPlanReadinessReason(readinessState, {
      plan,
      approvalStatus: approvalState,
      confidence,
    })
    const futureExecution = resolveFutureExecutionSummary({ plan, readinessState })
    const auditTrail = await buildGrowthLeadResearchExecutionPlanAuditTrail(admin, {
      organizationId: input.organizationId,
      leadId,
      planId,
    })
    const lead = await fetchGrowthLeadById(admin, leadId)

    items.push({
      planId,
      leadId,
      companyName: lead?.companyName ?? null,
      recommendedWorkflow: plan.workflowType,
      approvalState,
      readinessState,
      readinessReason,
      missingPrerequisites: plan.missingPrerequisites,
      evidenceSummary: snapshot.evidenceSummary,
      estimatedDuration: plan.estimatedDuration,
      estimatedCost: plan.estimatedCost,
      confidence,
      lastReviewedAt: review?.reviewedAt ?? null,
      lastReviewerUserId: review?.operatorUserId ?? null,
      lastReviewAction: review?.action ?? null,
      futureExecutionEligible: futureExecution.eligible,
      futureExecutionSummary: futureExecution.summary,
      auditTrail,
      observationHref:
        buildAiOsPilotLeadResearchHref(leadId) ?? `/growth/os/pilot/lead-research/${leadId}`,
    })
  }

  items.sort((left, right) => (right.lastReviewedAt ?? "").localeCompare(left.lastReviewedAt ?? ""))
  return items
}
