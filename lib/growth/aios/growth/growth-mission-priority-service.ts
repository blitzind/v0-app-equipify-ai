/** GE-AIOS-GROWTH-4F — Mission Prioritization service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthMissionFrameworkReadModel } from "@/lib/growth/aios/growth/growth-mission-framework-service"
import {
  buildMissionPriorityPlanContext,
  buildMissionPriorityReadModel,
  isMissionPrioritySchedulerActive,
  prioritizeAndAllocateMissions,
} from "@/lib/growth/aios/growth/growth-mission-priority-engine"
import type {
  GrowthMissionPriorityPlanContext,
  GrowthMissionPriorityReadModel,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"

export {
  scoreMissionPriority,
  buildMissionAllocationRecommendation,
  buildMissionQueueBuckets,
  detectMissionStarvation,
  prioritizeAndAllocateMissions,
  buildMissionPriorityReadModel,
  buildMissionPriorityPlanContext,
  buildRevenueOperatorCapacityGuidance,
  isMissionPrioritySchedulerActive,
} from "@/lib/growth/aios/growth/growth-mission-priority-engine"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthMissionPriorityReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthMissionPriorityReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const missionFramework = await buildGrowthMissionFrameworkReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  void isMissionPrioritySchedulerActive()

  return buildMissionPriorityReadModel({
    missions: missionFramework.missions,
    generatedAt,
  })
}

export async function buildGrowthMissionPriorityPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthMissionPriorityPlanContext | null> {
  const readModel = await buildGrowthMissionPriorityReadModel(admin, input)
  return buildMissionPriorityPlanContext({
    leadId: input.leadId,
    rankedMissions: readModel.rankedMissions,
  })
}

export async function buildGrowthMissionPriorityFromMissions(input: {
  missions: Parameters<typeof buildMissionPriorityReadModel>[0]["missions"]
  generatedAt?: string
}): Promise<GrowthMissionPriorityReadModel> {
  return buildMissionPriorityReadModel({
    missions: input.missions,
    generatedAt: input.generatedAt ?? nowIso(),
  })
}
