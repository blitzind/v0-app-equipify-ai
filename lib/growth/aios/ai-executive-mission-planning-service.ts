/** GE-AIOS-3D — Executive Mission Planning Tick (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiExecutiveBrainRuntime, updateAiExecutiveBrainRuntime } from "@/lib/growth/aios/ai-executive-brain-repository"
import { delegateAiExecutiveWorkOrder } from "@/lib/growth/aios/ai-executive-brain-service"
import type {
  AiExecutiveMissionPlanningCreatedWorkOrder,
  AiExecutiveMissionPlanningTickInput,
  AiExecutiveMissionPlanningTickResult,
  AiExecutiveWorkOrderProposal,
} from "@/lib/growth/aios/ai-executive-mission-planning-types"
import {
  buildExecutiveWorkOrderProposalsForMission,
  markDuplicateExecutiveWorkOrderProposals,
  resolveExecutiveMissionPlanningStage,
  selectableExecutiveWorkOrderProposals,
} from "@/lib/growth/aios/ai-executive-mission-planning-planner"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

function nowIso(): string {
  return new Date().toISOString()
}

async function publishPlanningEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    executiveRuntimeId: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "executive",
    producer: "executive_brain",
    source: "ai_executive_mission_planning_service",
    agentOwner: "executive_brain",
    missionId: input.missionId,
    correlationId: input.missionId,
    payload: {
      executive_runtime_id: input.executiveRuntimeId,
      ...(input.payload ?? {}),
    },
  })
}

async function publishWorkOrderProposed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    executiveRuntimeId: string
    proposal: AiExecutiveWorkOrderProposal
    mode: string
  },
) {
  return publishPlanningEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.work_order_proposed",
    missionId: input.missionId,
    executiveRuntimeId: input.executiveRuntimeId,
    payload: {
      mode: input.mode,
      work_order_type: input.proposal.workOrderType,
      assigned_agent: input.proposal.assignedAgent,
      entity_type: input.proposal.entityType,
      entity_id: input.proposal.entityId,
      proposal_key: input.proposal.proposalKey,
      duplicate: input.proposal.duplicate,
      rationale: input.proposal.rationale,
    },
  })
}

export async function runExecutiveMissionPlanningTick(
  admin: SupabaseClient,
  input: AiExecutiveMissionPlanningTickInput,
): Promise<AiExecutiveMissionPlanningTickResult> {
  const dryRun = input.mode === "dry_run"

  const runtime = await fetchAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })
  if (!runtime) throw new Error("ai_executive_brain_runtime_not_found")

  await publishPlanningEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.planning_tick_started",
    missionId: input.missionId,
    executiveRuntimeId: runtime.id,
    payload: {
      mode: input.mode,
      prepare_decision: input.prepareDecision ?? false,
      enable_ai_evidence: input.enableAiEvidence ?? false,
    },
  })

  try {
    const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
    if (!objective) throw new Error("growth_objective_not_found")

    const existingWorkOrders = await listAiWorkOrders(admin, {
      organizationId: input.organizationId,
      missionId: input.missionId,
    })

    const rawProposals = buildExecutiveWorkOrderProposalsForMission({
      objective,
      maxProposals: input.maxProposals,
    })
    const { proposals, skippedDuplicates } = markDuplicateExecutiveWorkOrderProposals({
      proposals: rawProposals,
      existingWorkOrders,
    })

    for (const proposal of proposals) {
      await publishWorkOrderProposed(admin, {
        organizationId: input.organizationId,
        missionId: input.missionId,
        executiveRuntimeId: runtime.id,
        proposal,
        mode: input.mode,
      })
    }

    const created: AiExecutiveMissionPlanningCreatedWorkOrder[] = []
    if (!dryRun) {
      for (const proposal of selectableExecutiveWorkOrderProposals(proposals)) {
        const delegationResult = await delegateAiExecutiveWorkOrder(admin, {
          organizationId: input.organizationId,
          executiveRuntimeId: runtime.id,
          missionId: input.missionId,
          workOrderType: proposal.workOrderType,
          assignedAgent: proposal.assignedAgent,
          entityType: proposal.entityType,
          entityId: proposal.entityId,
          priority: proposal.priority,
          payload: proposal.payload,
          prepareDecision: input.prepareDecision,
          enableAiEvidence: input.enableAiEvidence,
          metadata: {
            planning_tick: true,
            proposal_key: proposal.proposalKey,
            rationale: proposal.rationale,
          },
        })

        created.push({
          proposal,
          workOrderId: delegationResult.workOrder.id,
          delegationId: delegationResult.delegation.id,
          decisionPreparation: delegationResult.decisionPreparation,
        })
      }
    }

    await updateAiExecutiveBrainRuntime(admin, {
      organizationId: input.organizationId,
      executiveRuntimeId: runtime.id,
      patch: {
        runtime_status: dryRun ? runtime.runtimeStatus : "delegating",
        last_tick_at: nowIso(),
      },
    })

    const result: AiExecutiveMissionPlanningTickResult = {
      missionId: input.missionId,
      mode: input.mode,
      missionStageId: resolveExecutiveMissionPlanningStage(objective),
      missionStatus: objective.status,
      existingWorkOrderCount: existingWorkOrders.length,
      proposals,
      skippedDuplicates,
      created,
      dryRun,
    }

    await publishPlanningEvent(admin, {
      organizationId: input.organizationId,
      eventType: "executive.planning_tick_completed",
      missionId: input.missionId,
      executiveRuntimeId: runtime.id,
      payload: {
        mode: input.mode,
        proposal_count: proposals.length,
        skipped_duplicates: skippedDuplicates,
        created_count: created.length,
        dry_run: dryRun,
        mission_stage_id: result.missionStageId,
      },
    })

    return result
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await publishPlanningEvent(admin, {
      organizationId: input.organizationId,
      eventType: "executive.planning_tick_failed",
      missionId: input.missionId,
      executiveRuntimeId: runtime.id,
      payload: { detail, mode: input.mode },
    })
    throw error
  }
}
