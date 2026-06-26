/** GE-AIOS-3D — Deterministic mission planning proposals (client-safe). */

import type { GrowthObjective, GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import {
  EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS,
  type AiExecutiveWorkOrderProposal,
} from "@/lib/growth/aios/ai-executive-mission-planning-types"
import { executiveWorkOrderDispatchPlan } from "@/lib/growth/aios/ai-executive-work-order-dispatcher"
import {
  AI_WORK_ORDER_TERMINAL_STATUSES,
  AI_WORK_ORDER_TYPES,
  type AiWorkOrder,
  type AiWorkOrderType,
} from "@/lib/growth/aios/ai-work-order-types"

const CONSTITUTIONAL_WORK_ORDER_TYPES = new Set<string>(AI_WORK_ORDER_TYPES)
const TERMINAL_STATUSES = new Set<string>(AI_WORK_ORDER_TERMINAL_STATUSES)

export function buildExecutiveWorkOrderProposalKey(input: {
  workOrderType: AiWorkOrderType
  entityType: string | null
  entityId: string | null
}): string {
  return `${input.workOrderType}:${input.entityType ?? "_"}:${input.entityId ?? "_"}`
}

export function isConstitutionalExecutiveWorkOrderType(
  workOrderType: string,
): workOrderType is AiWorkOrderType {
  return CONSTITUTIONAL_WORK_ORDER_TYPES.has(workOrderType)
}

export function resolveExecutiveMissionPlanningStage(
  objective: GrowthObjective,
): GrowthObjectiveStageId {
  return objective.runtime?.currentStageId ?? "discover"
}

export function resolveExecutivePlanningEntityContext(objective: GrowthObjective): {
  entityType: string | null
  entityId: string | null
} {
  const leadSignal = objective.recentSignals.find((signal) => signal.leadId)
  if (leadSignal?.leadId) {
    return { entityType: "lead", entityId: leadSignal.leadId }
  }
  return { entityType: "mission", entityId: objective.id }
}

export function buildExecutiveWorkOrderProposalsForMission(input: {
  objective: GrowthObjective
  maxProposals?: number
}): AiExecutiveWorkOrderProposal[] {
  const stageId = resolveExecutiveMissionPlanningStage(input.objective)
  const bindings = EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS[stageId] ?? []
  const entity = resolveExecutivePlanningEntityContext(input.objective)
  const maxProposals = input.maxProposals ?? 3

  const proposals: AiExecutiveWorkOrderProposal[] = []
  for (const workOrderType of bindings) {
    if (!isConstitutionalExecutiveWorkOrderType(workOrderType)) continue
    const dispatch = executiveWorkOrderDispatchPlan({ workOrderType })
    const proposalKey = buildExecutiveWorkOrderProposalKey({
      workOrderType,
      entityType: entity.entityType,
      entityId: entity.entityId,
    })
    proposals.push({
      workOrderType,
      assignedAgent: dispatch.assignedAgent,
      entityType: entity.entityType,
      entityId: entity.entityId,
      priority: objectivePriorityScore(input.objective.priority),
      payload: {
        mission_id: input.objective.id,
        mission_stage_id: stageId,
        objective_type: input.objective.objectiveType,
        planning_tick: true,
      },
      rationale: `Mission stage ${stageId} requires ${workOrderType}`,
      proposalKey,
      duplicate: false,
    })
    if (proposals.length >= maxProposals) break
  }

  return proposals
}

function objectivePriorityScore(priority: GrowthObjective["priority"]): number {
  switch (priority) {
    case "critical":
      return 900
    case "high":
      return 750
    case "medium":
      return 500
    default:
      return 300
  }
}

export function markDuplicateExecutiveWorkOrderProposals(input: {
  proposals: AiExecutiveWorkOrderProposal[]
  existingWorkOrders: AiWorkOrder[]
}): { proposals: AiExecutiveWorkOrderProposal[]; skippedDuplicates: number } {
  const activeKeys = new Set<string>()
  for (const workOrder of input.existingWorkOrders) {
    if (TERMINAL_STATUSES.has(workOrder.status)) continue
    activeKeys.add(
      buildExecutiveWorkOrderProposalKey({
        workOrderType: workOrder.workOrderType,
        entityType: workOrder.entityType,
        entityId: workOrder.entityId,
      }),
    )
  }

  let skippedDuplicates = 0
  const proposals = input.proposals.map((proposal) => {
    const duplicate = activeKeys.has(proposal.proposalKey)
    if (duplicate) skippedDuplicates += 1
    return { ...proposal, duplicate }
  })

  return { proposals, skippedDuplicates }
}

export function selectableExecutiveWorkOrderProposals(
  proposals: AiExecutiveWorkOrderProposal[],
): AiExecutiveWorkOrderProposal[] {
  return proposals.filter((proposal) => !proposal.duplicate)
}
