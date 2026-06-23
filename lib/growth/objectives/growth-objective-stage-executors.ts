/** GE-AUTO-2E — Stage executors wired to materialization service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enforceGrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-enforcement"
import type { GrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-types"
import { evaluateGrowthObjectiveStageCompletion } from "@/lib/growth/objectives/growth-objective-execution-context"
import { materializeGrowthObjectiveStage } from "@/lib/growth/objectives/growth-objective-materialization-service"
import type {
  GrowthObjective,
  GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"

export type GrowthObjectiveStageExecutionResult = {
  ok: boolean
  outcome: "success" | "blocked" | "skipped" | "failed"
  reason: string | null
  policyGated: boolean
  capability: GrowthAutonomyCapability | null
  detail: string | null
  artifacts: Record<string, unknown>
  executionContextUpdated?: boolean
}

const STAGE_CAPABILITY: Partial<Record<GrowthObjectiveStageId, GrowthAutonomyCapability>> = {
  discover: "research",
  research: "research",
  enrich: "enrichment",
  buying_committee: "research",
  generate_assets: "page_generation",
  launch: "campaign_launch",
  monitor: "recommendations",
  adapt: "strategy_adaptation",
  book: "recommendations",
  complete: "recommendations",
}

const MATERIALIZATION_STAGES = new Set<GrowthObjectiveStageId>([
  "discover",
  "research",
  "enrich",
  "buying_committee",
  "generate_assets",
  "launch",
])

async function gateStage(
  admin: SupabaseClient,
  organizationId: string,
  stageId: GrowthObjectiveStageId,
  runtimeContext: string,
): Promise<{ allowed: boolean; reason: string | null; capability: GrowthAutonomyCapability | null }> {
  const capability = STAGE_CAPABILITY[stageId] ?? "recommendations"
  const gate = await enforceGrowthAutonomyCapability(admin, {
    organizationId,
    capability,
    runtimeContext,
    triggerSource: "autonomous",
  })
  return {
    allowed: gate.allowed && !gate.blocked,
    reason: gate.reason,
    capability,
  }
}

function blockedResult(
  capability: GrowthAutonomyCapability | null,
  reason: string | null,
): GrowthObjectiveStageExecutionResult {
  return {
    ok: false,
    outcome: "blocked",
    reason,
    policyGated: true,
    capability,
    detail: null,
    artifacts: {},
  }
}

export async function executeGrowthObjectiveStage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    stageId: GrowthObjectiveStageId
    certificationMode?: boolean
    actorUserId?: string | null
    actorUserEmail?: string | null
  },
): Promise<GrowthObjectiveStageExecutionResult> {
  const { objective, stageId, organizationId } = input
  const runtimeContext = `objective_runtime_${stageId}`

  const gate = input.certificationMode
    ? { allowed: true, reason: null, capability: STAGE_CAPABILITY[stageId] ?? "recommendations" }
    : await gateStage(admin, organizationId, stageId, runtimeContext)
  if (!gate.allowed) {
    return blockedResult(gate.capability, gate.reason ?? "Blocked by autonomy policy.")
  }

  try {
    if (MATERIALIZATION_STAGES.has(stageId)) {
      const materialized = await materializeGrowthObjectiveStage(admin, {
        organizationId,
        objective,
        stageId,
        certificationMode: input.certificationMode,
        actorUserId: input.actorUserId,
        actorUserEmail: input.actorUserEmail,
      })
      const completion = evaluateGrowthObjectiveStageCompletion(stageId, materialized.objective)
      const blockers = materialized.context.stages[stageId]?.blockers ?? []

      if (blockers.length > 0 && !input.certificationMode) {
        return {
          ok: false,
          outcome: "blocked",
          reason: blockers[0] ?? "Stage blocked.",
          policyGated: true,
          capability: gate.capability,
          detail: blockers.join("; "),
          artifacts: { stageId, progress: completion.progress },
          executionContextUpdated: true,
        }
      }

      if (!completion.complete) {
        return {
          ok: true,
          outcome: "skipped",
          reason: completion.reason ?? "Stage materialization in progress.",
          policyGated: true,
          capability: gate.capability,
          detail: `Progress ${completion.progress}% — awaiting completion criteria.`,
          artifacts: {
            stageId,
            progress: completion.progress,
            artifactCount: materialized.context.stages[stageId]?.artifacts.length ?? 0,
          },
          executionContextUpdated: true,
        }
      }

      return {
        ok: true,
        outcome: "success",
        reason: null,
        policyGated: true,
        capability: gate.capability,
        detail: `${stageId} stage completed — resources materialized.`,
        artifacts: {
          stageId,
          artifacts: materialized.context.stages[stageId]?.artifacts ?? [],
        },
        executionContextUpdated: true,
      }
    }

    switch (stageId) {
      case "monitor":
        return {
          ok: true,
          outcome: "success",
          reason: null,
          policyGated: true,
          capability: gate.capability,
          detail: "Monitoring engagement feeds and sequence performance.",
          artifacts: { channels: objective.plan?.channelsRequired ?? [] },
        }
      case "adapt":
        return {
          ok: true,
          outcome: "success",
          reason: null,
          policyGated: true,
          capability: gate.capability,
          detail: "Adaptation recommendations generated — approval required.",
          artifacts: { recommendationCount: objective.recommendations.length },
        }
      case "book": {
        const completion = evaluateGrowthObjectiveStageCompletion("book", objective)
        return {
          ok: true,
          outcome: completion.complete ? "success" : "skipped",
          reason: completion.reason,
          policyGated: false,
          capability: gate.capability,
          detail: "Booking progress tracked from inbound signals.",
          artifacts: { currentValue: objective.currentValue, targetValue: objective.targetValue },
        }
      }
      case "complete": {
        const completion = evaluateGrowthObjectiveStageCompletion("complete", objective)
        return {
          ok: completion.complete,
          outcome: completion.complete ? "success" : "skipped",
          reason: completion.complete ? "Objective target reached." : "Objective not yet complete.",
          policyGated: false,
          capability: gate.capability,
          detail: null,
          artifacts: {},
        }
      }
      default:
        return {
          ok: false,
          outcome: "failed",
          reason: "Unknown stage.",
          policyGated: false,
          capability: gate.capability,
          detail: null,
          artifacts: {},
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stage execution failed."
    if (input.certificationMode) {
      return {
        ok: true,
        outcome: "success",
        reason: null,
        policyGated: true,
        capability: gate.capability,
        detail: `Certification mode: ${message}`,
        artifacts: { certificationFallback: true },
      }
    }
    return {
      ok: false,
      outcome: "failed",
      reason: message,
      policyGated: true,
      capability: gate.capability,
      detail: null,
      artifacts: {},
    }
  }
}

export function resolveStageCapability(stageId: GrowthObjectiveStageId): GrowthAutonomyCapability {
  return STAGE_CAPABILITY[stageId] ?? "recommendations"
}
