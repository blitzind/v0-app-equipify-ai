/** GE-AIOS-GROWTH-5A — Scheduler Readiness service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import { enrichSchedulerReadinessWithAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  buildSchedulerReadinessPlanContext,
  buildSchedulerReadinessReadModel,
  isSchedulerReadinessActive,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-engine"
import type {
  GrowthSchedulerReadinessPlanContext,
  GrowthSchedulerReadinessReadModel,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export {
  buildAgentWakeRules,
  buildSchedulerBudgetLimits,
  buildSchedulerPriorityQueueSnapshot,
  buildSchedulerReadinessReadModel,
  buildSchedulerReadinessPlanContext,
  buildSchedulerReadinessRecord,
  buildSchedulerThrottleRules,
  isSchedulerReadinessActive,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-engine"

function nowIso(): string {
  return new Date().toISOString()
}

export async function buildGrowthSchedulerReadinessReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthSchedulerReadinessReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  void isSchedulerReadinessActive()

  const base = buildSchedulerReadinessReadModel({
    organizationId: input.organizationId,
    missionPriority,
    generatedAt,
  })

  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  return enrichSchedulerReadinessWithAutonomyPolicy(base, policy)
}

export async function buildGrowthSchedulerReadinessPlanContext(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; generatedAt?: string },
): Promise<GrowthSchedulerReadinessPlanContext | null> {
  const generatedAt = input.generatedAt ?? nowIso()
  const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const readiness = await buildGrowthSchedulerReadinessReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  return buildSchedulerReadinessPlanContext({
    leadId: input.leadId,
    missionPriority,
    readiness,
  })
}
