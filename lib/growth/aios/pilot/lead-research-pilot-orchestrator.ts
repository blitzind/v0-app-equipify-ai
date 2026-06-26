/** GE-AIOS-4A — Lead Research Pilot orchestrator (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { bridgeLegacyEventToAiOs } from "@/lib/growth/aios/ai-event-bridge"
import {
  listAiExecutiveBrainRuntimes,
  upsertAiExecutiveBrainRuntime,
} from "@/lib/growth/aios/ai-executive-brain-repository"
import { startAiExecutiveBrainRuntime } from "@/lib/growth/aios/ai-executive-brain-service"
import { runExecutiveMissionPlanningTick } from "@/lib/growth/aios/ai-executive-mission-planning-service"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { executeResearchCompanyWorkOrderViaAiOs } from "@/lib/growth/aios/pilot/lead-research-agent-executor"
import { isLeadResearchPilotEnabled, resolveLeadResearchPilotConfig } from "@/lib/growth/aios/pilot/lead-research-pilot-config"
import {
  bindLeadToLeadResearchPilotMission,
  ensureLeadResearchPilotMission,
} from "@/lib/growth/aios/pilot/lead-research-pilot-mission-service"
import {
  publishLeadResearchPilotStepEvent,
} from "@/lib/growth/aios/pilot/lead-research-pilot-observability"
import { publishGrowthLeadResearchWorkflowStatus } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  LEAD_RESEARCH_PILOT_EXECUTIVE_INSTANCE_ID,
  type LeadResearchPilotStepId,
} from "@/lib/growth/aios/pilot/lead-research-pilot-types"

export type LeadResearchPilotStartInput = {
  admin: SupabaseClient
  leadId: string
  organizationId?: string
  createdBy?: string | null
  source?: string
}

export type LeadResearchPilotStartResult =
  | {
      started: true
      leadId: string
      missionId: string
      workOrderId: string
      researchRunId: string | null
    }
  | {
      started: false
      reason: "disabled" | "not_configured"
    }

async function markPilotStep(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    missionId?: string | null
    workOrderId?: string | null
    stepId: LeadResearchPilotStepId
    status: "running" | "completed" | "failed" | "skipped"
    detail?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await publishLeadResearchPilotStepEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    stepId: input.stepId,
    status: input.status,
    detail: input.detail,
    metadata: input.metadata,
  })
}

async function resolveExecutiveRuntimeForPilot(
  admin: SupabaseClient,
  organizationId: string,
) {
  const runtimes = await listAiExecutiveBrainRuntimes(admin, { organizationId })
  const existing = runtimes.find((runtime) => runtime.instanceId === LEAD_RESEARCH_PILOT_EXECUTIVE_INSTANCE_ID)
  if (existing) return existing

  const runtime = await upsertAiExecutiveBrainRuntime(admin, {
    organizationId,
    instanceId: LEAD_RESEARCH_PILOT_EXECUTIVE_INSTANCE_ID,
    runtimeStatus: "planning",
    metadata: { pilot: "lead_research" },
  })

  await startAiExecutiveBrainRuntime(admin, {
    organizationId,
    instanceId: runtime.instanceId,
    metadata: { pilot: "lead_research" },
  })

  return runtime
}

function findCreatedResearchWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; leadId: string; createdWorkOrderIds: string[] },
) {
  return listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
  }).then((rows) => {
    const createdSet = new Set(input.createdWorkOrderIds)
    return (
      rows.find(
        (row) =>
          createdSet.has(row.id) &&
          row.workOrderType === "research_company" &&
          row.entityType === "lead" &&
          row.entityId === input.leadId,
      ) ??
      rows.find(
        (row) =>
          row.workOrderType === "research_company" &&
          row.entityType === "lead" &&
          row.entityId === input.leadId &&
          row.status !== "completed" &&
          row.status !== "cancelled",
      ) ??
      null
    )
  })
}

export async function startLeadResearchPilotForProspect(
  admin: SupabaseClient,
  input: LeadResearchPilotStartInput,
): Promise<LeadResearchPilotStartResult> {
  if (!isLeadResearchPilotEnabled()) {
    return { started: false, reason: "disabled" }
  }

  const organizationId = input.organizationId ?? getGrowthEngineAiOrgId()
  if (!organizationId) {
    return { started: false, reason: "not_configured" }
  }

  const config = resolveLeadResearchPilotConfig()
  const source = input.source ?? "lead_research_pilot_orchestrator"

  try {
    await publishGrowthLeadResearchWorkflowStatus(admin, {
      organizationId,
      leadId: input.leadId,
      workflowStatus: "researching",
      detail: source,
    })

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      stepId: "prospect_created",
      status: "running",
      detail: source,
    })

    await bridgeLegacyEventToAiOs(admin, {
      organizationId,
      bridgeSource: "lead_timeline",
      legacyEventId: `${input.leadId}:prospect_created`,
      eventType: "growth.prospect_created",
      category: "mission",
      producer: "growth_lead_repository",
      entityType: "lead",
      entityId: input.leadId,
      correlationId: input.leadId,
      payload: {
        lead_id: input.leadId,
        pilot: "lead_research",
        source,
      },
      replayKey: `bridge:lead_timeline:${input.leadId}:prospect_created:pilot`,
    })

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      stepId: "prospect_created",
      status: "completed",
    })

    const mission = await ensureLeadResearchPilotMission(admin, organizationId)
    await bindLeadToLeadResearchPilotMission(admin, {
      organizationId,
      missionId: mission.id,
      leadId: input.leadId,
    })

    const executiveRuntime = await resolveExecutiveRuntimeForPilot(admin, organizationId)

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      missionId: mission.id,
      stepId: "executive_planning_tick",
      status: "running",
    })

    const planningResult = await runExecutiveMissionPlanningTick(admin, {
      organizationId,
      executiveRuntimeId: executiveRuntime.id,
      missionId: mission.id,
      mode: "create",
      prepareDecision: true,
      enableAiEvidence: config.enableAiEvidence,
      maxProposals: 1,
      source,
    })

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      missionId: mission.id,
      stepId: "executive_planning_tick",
      status: "completed",
      detail: `proposals=${planningResult.proposals.length}; created=${planningResult.created.length}`,
    })

    const createdWorkOrderIds = planningResult.created.map((row) => row.workOrderId)
    const workOrder = await findCreatedResearchWorkOrder(admin, {
      organizationId,
      missionId: mission.id,
      leadId: input.leadId,
      createdWorkOrderIds,
    })

    if (!workOrder) {
      throw new Error("lead_research_pilot_work_order_not_created")
    }

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      missionId: mission.id,
      workOrderId: workOrder.id,
      stepId: "work_order_created",
      status: "completed",
      detail: workOrder.id,
    })

    const decisionPreparation = planningResult.created.find((row) => row.workOrderId === workOrder.id)?.decisionPreparation
    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      missionId: mission.id,
      workOrderId: workOrder.id,
      stepId: "decision_preparation",
      status: decisionPreparation?.prepared ? "completed" : decisionPreparation ? "failed" : "skipped",
      detail:
        decisionPreparation && "prepared" in decisionPreparation && decisionPreparation.prepared
          ? decisionPreparation.decisionRecordId
          : decisionPreparation && "failureReason" in decisionPreparation
            ? decisionPreparation.failureReason
            : null,
    })

    const execution = await executeResearchCompanyWorkOrderViaAiOs(admin, {
      organizationId,
      workOrderId: workOrder.id,
      leadId: input.leadId,
      createdBy: input.createdBy ?? null,
    })

    logGrowthEngine("lead_research_pilot_completed", {
      leadId: input.leadId,
      missionId: mission.id,
      workOrderId: execution.workOrder.id,
      researchRunId: execution.researchRunId,
    })

    return {
      started: true,
      leadId: input.leadId,
      missionId: mission.id,
      workOrderId: execution.workOrder.id,
      researchRunId: execution.researchRunId,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await publishGrowthLeadResearchWorkflowStatus(admin, {
      organizationId,
      leadId: input.leadId,
      workflowStatus: "failed",
      detail,
    }).catch(() => undefined)

    await markPilotStep(admin, {
      organizationId,
      leadId: input.leadId,
      stepId: "work_order_complete",
      status: "failed",
      detail,
    }).catch(() => undefined)

    logGrowthEngine("lead_research_pilot_failed", {
      leadId: input.leadId,
      detail: detail.slice(0, 500),
    })
    throw error
  }
}

export function scheduleLeadResearchPilotForProspect(
  admin: SupabaseClient,
  input: Omit<LeadResearchPilotStartInput, "admin">,
): void {
  if (!isLeadResearchPilotEnabled()) return

  const organizationId = input.organizationId ?? getGrowthEngineAiOrgId()
  if (organizationId) {
    void publishGrowthLeadResearchWorkflowStatus(admin, {
      organizationId,
      leadId: input.leadId,
      workflowStatus: "scheduled",
      detail: input.source ?? "lead_created",
    }).catch(() => undefined)
  }

  void startLeadResearchPilotForProspect(admin, { ...input, admin }).catch((error) => {
    const detail = error instanceof Error ? error.message : String(error)
    logGrowthEngine("lead_research_pilot_async_failed", {
      leadId: input.leadId,
      detail: detail.slice(0, 500),
    })
  })
}
