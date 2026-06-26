/** GE-AIOS-4A — Lead Research Pilot observability (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import {
  LEAD_RESEARCH_PILOT_STEP_LABELS,
  LEAD_RESEARCH_PILOT_STEPS,
  type LeadResearchPilotObservation,
  type LeadResearchPilotStepId,
  type LeadResearchPilotStepRecord,
  type LeadResearchPilotStepStatus,
} from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthLeadResearchRuns } from "@/lib/growth/research-repository"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { isLeadResearchPilotEnabled, resolveLeadResearchPilotConfig } from "@/lib/growth/aios/pilot/lead-research-pilot-config"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
  publishGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  deriveGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"

/** AI OS events store correlation_id as uuid — use lead id directly. */
function pilotCorrelationId(leadId: string): string {
  return leadId
}

function defaultSteps(): LeadResearchPilotStepRecord[] {
  return LEAD_RESEARCH_PILOT_STEPS.map((stepId) => ({
    stepId,
    label: LEAD_RESEARCH_PILOT_STEP_LABELS[stepId],
    status: "pending",
    occurredAt: null,
    detail: null,
    metadata: {},
  }))
}

export async function publishLeadResearchPilotStepEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    missionId?: string | null
    workOrderId?: string | null
    stepId: LeadResearchPilotStepId
    status: LeadResearchPilotStepStatus
    detail?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const eventType =
    input.status === "failed"
      ? "pilot.lead_research_step_failed"
      : input.stepId === "prospect_created" && input.status === "running"
        ? "pilot.lead_research_started"
        : input.stepId === "work_order_complete" && input.status === "completed"
          ? "pilot.lead_research_completed"
          : "pilot.lead_research_step_completed"

  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType,
    category: "system",
    producer: "lead_research_pilot",
    source: "lead_research_pilot_observability",
    missionId: input.missionId ?? null,
    workOrderId: input.workOrderId ?? null,
    entityType: "lead",
    entityId: input.leadId,
    correlationId: pilotCorrelationId(input.leadId),
    payload: {
      step_id: input.stepId,
      step_label: LEAD_RESEARCH_PILOT_STEP_LABELS[input.stepId],
      step_status: input.status,
      detail: input.detail ?? null,
      ...(input.metadata ?? {}),
    },
  })
}

export async function fetchLeadResearchPilotObservation(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<LeadResearchPilotObservation> {
  const correlationId = pilotCorrelationId(input.leadId)
  const steps = defaultSteps()
  const stepIndex = new Map(steps.map((step, index) => [step.stepId, index]))

  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    correlationId,
    limit: 200,
  })

  let lastError: string | null = null
  let updatedAt: string | null = null
  let missionId: string | null = null
  let workOrderId: string | null = null

  for (const event of events) {
    updatedAt = event.occurredAt
    if (event.missionId) missionId = event.missionId
    if (event.workOrderId) workOrderId = event.workOrderId

    const payload = event.payload ?? {}
    const stepId = payload.step_id
    if (typeof stepId !== "string" || !stepIndex.has(stepId as LeadResearchPilotStepId)) continue

    const index = stepIndex.get(stepId as LeadResearchPilotStepId)!
    const stepStatus = payload.step_status
    steps[index] = {
      ...steps[index],
      status:
        stepStatus === "completed" ||
        stepStatus === "failed" ||
        stepStatus === "running" ||
        stepStatus === "skipped"
          ? stepStatus
          : steps[index].status,
      occurredAt: event.occurredAt,
      detail: typeof payload.detail === "string" ? payload.detail : steps[index].detail,
      metadata: { ...steps[index].metadata, event_type: event.eventType },
    }

    if (stepStatus === "failed" && typeof payload.detail === "string") {
      lastError = payload.detail
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!workOrderId) {
    const workOrders = await listAiWorkOrders(admin, {
      organizationId: input.organizationId,
      missionId: missionId ?? undefined,
    })
    const match = workOrders.find(
      (row) =>
        row.entityType === "lead" &&
        row.entityId === input.leadId &&
        row.workOrderType === "research_company",
    )
    workOrderId = match?.id ?? null
    missionId = match?.missionId ?? missionId
  }

  const researchRuns = await listGrowthLeadResearchRuns(admin, input.leadId, 1)
  const latestRun = researchRuns.find((run) => run.modelTask === "ai_os_pilot_research_company") ?? researchRuns[0]

  const workflowSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  const workflowStatus = deriveGrowthLeadResearchWorkflowStatus({
    steps,
    explicitStatus: workflowSnapshot?.workflowStatus ?? null,
    qualification: workflowSnapshot?.qualification ?? null,
    hasOpportunityAssessment: Boolean(workflowSnapshot?.opportunityAssessment),
  })

  return {
    leadId: input.leadId,
    companyName: lead?.companyName ?? null,
    missionId,
    workOrderId,
    researchRunId: latestRun?.id ?? workflowSnapshot?.researchRunId ?? null,
    pilotEnabled: isLeadResearchPilotEnabled(),
    enableAiEvidence: resolveLeadResearchPilotConfig().enableAiEvidence,
    correlationId,
    steps,
    lastError,
    updatedAt: workflowSnapshot?.updatedAt ?? updatedAt,
    workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
    workflowStatus,
    qualification: workflowSnapshot?.qualification ?? null,
    recommendedWorkOrderType: workflowSnapshot?.qualification?.recommendedWorkOrderType ?? null,
    opportunityAssessment: workflowSnapshot?.opportunityAssessment ?? null,
    nextBestAction: workflowSnapshot?.nextBestAction ?? null,
    evidenceSummary: workflowSnapshot?.evidenceSummary ?? null,
    executionPlan: workflowSnapshot?.executionPlan ?? null,
  }
}
