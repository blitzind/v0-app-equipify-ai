/** GE-AIOS-3D — Executive Mission Planning types (client-safe). */

import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import type { AiOsRuntimeAgent } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import type { AiExecutiveDecisionPreparationResult } from "@/lib/growth/aios/ai-executive-decision-preparation-types"

export const GROWTH_AIOS_3D_PHASE = "GE-AIOS-3D" as const

export const GROWTH_AI_EXECUTIVE_MISSION_PLANNING_QA_MARKER =
  "growth-aios-3d-executive-mission-planning-v1" as const

export const AI_EXECUTIVE_MISSION_PLANNING_MODES = ["dry_run", "create"] as const

export type AiExecutiveMissionPlanningMode = (typeof AI_EXECUTIVE_MISSION_PLANNING_MODES)[number]

export type AiExecutiveWorkOrderProposal = {
  workOrderType: AiWorkOrderType
  assignedAgent: AiOsRuntimeAgent
  entityType: string | null
  entityId: string | null
  priority: number
  payload: Record<string, unknown>
  rationale: string
  proposalKey: string
  duplicate: boolean
}

export type AiExecutiveMissionPlanningTickInput = {
  organizationId: string
  executiveRuntimeId: string
  missionId: string
  mode: AiExecutiveMissionPlanningMode
  prepareDecision?: boolean
  enableAiEvidence?: boolean
  maxProposals?: number
  source?: string
}

export type AiExecutiveMissionPlanningCreatedWorkOrder = {
  proposal: AiExecutiveWorkOrderProposal
  workOrderId: string
  delegationId: string
  decisionPreparation: AiExecutiveDecisionPreparationResult | null
}

export type AiExecutiveMissionPlanningTickResult = {
  missionId: string
  mode: AiExecutiveMissionPlanningMode
  missionStageId: GrowthObjectiveStageId | null
  missionStatus: string | null
  existingWorkOrderCount: number
  proposals: AiExecutiveWorkOrderProposal[]
  skippedDuplicates: number
  created: AiExecutiveMissionPlanningCreatedWorkOrder[]
  dryRun: boolean
}

/** Stage → constitutional Work Order types (deterministic, no LLM). */
export const EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS: Readonly<
  Record<GrowthObjectiveStageId, readonly AiWorkOrderType[]>
> = {
  discover: ["research_company"],
  research: ["research_company"],
  enrich: ["verify_email"],
  buying_committee: ["generate_buying_committee"],
  generate_assets: ["generate_email"],
  launch: ["enroll_sequence"],
  monitor: ["analyze_reply"],
  adapt: ["pause_sequence"],
  book: ["prepare_meeting", "create_opportunity"],
  complete: [],
}

export const AI_EXECUTIVE_MISSION_PLANNING_RUNTIME_RULE =
  "Executive Mission Planning Tick observes mission state and proposes Work Orders — it never claims, executes, sends outbound, or calls providers directly." as const
