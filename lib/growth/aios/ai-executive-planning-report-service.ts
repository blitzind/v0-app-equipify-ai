/** GE-AIOS-5A — Executive Planning Report fetch (server-only, read-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAiContextEntityMetadata } from "@/lib/growth/aios/ai-context-assembly-resolver"
import { listAiDecisionRecords } from "@/lib/growth/aios/ai-decision-record-repository"
import { listAiMemoryRegistryEntries } from "@/lib/growth/aios/ai-memory-registry-repository"
import {
  GROWTH_AI_OS_MISSION_ID_INVALID_ERROR,
  resolveAiOsMissionIdParam,
} from "@/lib/growth/aios/ai-os-mission-route-params"
import type { AiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import { synthesizeAiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-synthesizer"
import {
  buildExecutiveWorkOrderProposalsForMission,
  markDuplicateExecutiveWorkOrderProposals,
  resolveExecutiveMissionPlanningStage,
  resolveExecutivePlanningEntityContext,
} from "@/lib/growth/aios/ai-executive-mission-planning-planner"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { isAiWorkOrderActiveStatus } from "@/lib/growth/aios/ai-work-order-types"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

function nowIso(): string {
  return new Date().toISOString()
}

function assertMissionId(missionId: string): string {
  const resolved = resolveAiOsMissionIdParam(missionId)
  if (!resolved.ok) throw new Error(GROWTH_AI_OS_MISSION_ID_INVALID_ERROR)
  return resolved.missionId
}

export async function fetchAiExecutivePlanningReport(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; maxProposals?: number },
): Promise<AiExecutivePlanningReport> {
  const missionId = assertMissionId(input.missionId)
  const objective = await getGrowthObjective(admin, input.organizationId, missionId)
  if (!objective) throw new Error("growth_objective_not_found")

  const currentStageId = resolveExecutiveMissionPlanningStage(objective)
  const entity = resolveExecutivePlanningEntityContext(objective)
  const entityMetadata = await resolveAiContextEntityMetadata(admin, {
    organizationId: input.organizationId,
    entityType: entity.entityType,
    entityId: entity.entityId,
  })

  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId,
  })
  const activeWorkOrders = workOrders.filter((row) => isAiWorkOrderActiveStatus(row.status))

  const proposals = buildExecutiveWorkOrderProposalsForMission({
    objective,
    maxProposals: input.maxProposals ?? 10,
  })
  const { proposals: markedProposals } = markDuplicateExecutiveWorkOrderProposals({
    proposals,
    existingWorkOrders: workOrders,
  })

  const [decisionRecords, memoryEntries] = await Promise.all([
    listAiDecisionRecords(admin, {
      organizationId: input.organizationId,
      missionId,
      limit: 20,
    }),
    listAiMemoryRegistryEntries(admin, {
      organizationId: input.organizationId,
      missionId,
      limit: 20,
    }),
  ])

  const sourcesUsed = [
    "growth_objective_planner",
    "growth_objective_forecast",
    "ai_executive_mission_planning_planner",
    "ai_context_assembly_resolver",
    "ai_decision_records",
    "ai_memory_registry",
  ]

  return synthesizeAiExecutivePlanningReport({
    reportId: randomUUID(),
    generatedAt: nowIso(),
    objective,
    currentStageId,
    proposedWorkOrders: markedProposals,
    activeWorkOrderCount: activeWorkOrders.length,
    decisionRecordCount: decisionRecords.length,
    memoryEntryCount: memoryEntries.length,
    entityProjection: (entityMetadata?.projection as Record<string, unknown> | undefined) ?? undefined,
    sourcesUsed,
  })
}
