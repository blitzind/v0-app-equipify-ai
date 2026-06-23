/** GE-AUTO-1F — Objective orchestration through autonomy policy (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enforceGrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-enforcement"
import type { GrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-types"
import type {
  GrowthObjectiveExecutionPlan,
  GrowthObjectiveOrchestrationRequest,
  GrowthObjectiveOrchestrationResult,
} from "@/lib/growth/objectives/growth-objective-types"

const PLAN_CAPABILITY_MAP: Record<string, GrowthAutonomyCapability> = {
  prospect_search: "research",
  audience_generation: "audience_generation",
  page_generation: "page_generation",
  video_generation: "video_generation",
  campaign_launch: "campaign_launch",
  email_send: "email_execution",
  sms_send: "sms_execution",
  voice_send: "voice_execution",
  strategy_adaptation: "strategy_adaptation",
  recommendations: "recommendations",
}

export function resolveObjectivePlanCapabilities(
  plan: GrowthObjectiveExecutionPlan,
): GrowthObjectiveOrchestrationRequest[] {
  const requests: GrowthObjectiveOrchestrationRequest[] = [
    {
      capability: "research",
      runtimeContext: "objective_plan_discover",
      label: "Prospect search / research",
    },
    {
      capability: "audience_generation",
      runtimeContext: "objective_plan_audiences",
      label: "Audience generation",
    },
    {
      capability: "page_generation",
      runtimeContext: "objective_plan_assets",
      label: "Personalized page generation",
    },
    {
      capability: "video_generation",
      runtimeContext: "objective_plan_assets",
      label: "AI video generation",
    },
    {
      capability: "campaign_launch",
      runtimeContext: "objective_plan_launch",
      label: "Campaign launch preparation",
    },
    {
      capability: "strategy_adaptation",
      runtimeContext: "objective_plan_adapt",
      label: "Strategy adaptation recommendations",
    },
    {
      capability: "recommendations",
      runtimeContext: "objective_plan_monitor",
      label: "Monitor recommendations",
    },
  ]

  for (const channel of plan.channelsRequired) {
    const capability =
      channel === "email" ? "email_execution" : channel === "sms" ? "sms_execution" : "voice_execution"
    requests.push({
      capability,
      runtimeContext: `objective_plan_${channel}`,
      label: `${channel} autonomous send (policy-gated)`,
    })
  }

  return requests
}

export async function evaluateObjectivePlanOrchestration(
  admin: SupabaseClient,
  input: {
    organizationId: string
    plan: GrowthObjectiveExecutionPlan
  },
): Promise<GrowthObjectiveOrchestrationResult[]> {
  const requests = resolveObjectivePlanCapabilities(input.plan)
  const results: GrowthObjectiveOrchestrationResult[] = []

  for (const request of requests) {
    const gate = await enforceGrowthAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: request.capability,
      runtimeContext: request.runtimeContext,
      triggerSource: "autonomous",
    })
    results.push({
      capability: request.capability,
      label: request.label,
      allowed: gate.allowed,
      blocked: gate.blocked,
      reason: gate.reason,
      requiresApproval: gate.result?.requiresApproval ?? true,
    })
  }

  return results
}

export function resolveObjectiveOrchestrationCapability(
  actionKey: string,
): GrowthAutonomyCapability | null {
  return PLAN_CAPABILITY_MAP[actionKey] ?? null
}
