/** GE-AIOS-BURN-IN-1A — Immediate post-activation production tick (existing scheduler only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"

export const GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER =
  "ge-aios-burn-in-1a-immediate-activation-tick-v1" as const

export type GrowthAvaActivationImmediateTick = {
  qaMarker: typeof GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER
  ranAt: string
  schedulerRan: boolean
  organizationsExecuted: number
  outcomesCompleted: number
  packagesGenerated: number
  missionBootstrapsCompleted: number
  stopReason: string | null
  operatorLines: string[]
  error: string | null
}

function buildOperatorLines(input: {
  organizationsExecuted: number
  outcomesCompleted: number
  packagesGenerated: number
  missionBootstrapsCompleted: number
  stopReason: string | null
  skippedReason: string | null
}): string[] {
  const lines: string[] = ["Activation complete — I'm beginning work now."]

  if (input.missionBootstrapsCompleted > 0) {
    lines.push("Production mission bootstrap completed.")
  }

  if (input.organizationsExecuted > 0) {
    lines.push(
      input.outcomesCompleted > 0
        ? `Autonomous work started — ${input.outcomesCompleted} outcome${input.outcomesCompleted === 1 ? "" : "s"} completed in this cycle.`
        : "Autonomous work started — I'm processing my work queue.",
    )
  }

  if (input.packagesGenerated > 0) {
    lines.push(
      `${input.packagesGenerated} outreach ${input.packagesGenerated === 1 ? "package was" : "packages were"} prepared for your review.`,
    )
  }

  if (input.stopReason) {
    lines.push(humanizeStopReason(input.stopReason))
  } else if (input.skippedReason) {
    lines.push(humanizeStopReason(input.skippedReason))
  }

  if (lines.length === 1) {
    lines.push(
      "Nothing was queued for immediate execution. I'll continue on my regular schedule (about every 20 minutes) and update Home as real work completes.",
    )
  }

  return lines
}

function humanizeStopReason(code: string): string {
  switch (code) {
    case "autonomy_disabled":
      return "Autonomous mode wasn't enabled when the cycle ran — this shouldn't happen after activation."
    case "no_executable_work":
      return "I'm ready but nothing is in my work queue yet — discovery may need to return companies first."
    case "operator_required":
    case "operator_approval_required":
      return "I'm waiting for your approval before I can continue."
    case "daily_budget_exhausted":
      return "I've reached today's autonomous work budget and will resume on the next cycle."
    default:
      return `I'm waiting: ${code.replace(/_/g, " ")}.`
  }
}

/** Runs the same production scheduler tick the cron uses — once, immediately after activation. */
export async function runGrowthAvaActivationImmediateProductionTick(input: {
  admin: SupabaseClient
  organizationId: string
}): Promise<GrowthAvaActivationImmediateTick> {
  const ranAt = new Date().toISOString()

  try {
    const result = await runGrowthObjectiveRuntimeScheduler(input.admin)

    const asl = result.autonomousSalesLoop
    const orgResult = asl?.organization_results.find((row) => row.organizationId === input.organizationId) ?? null
    const organizationsExecuted = asl?.organizations_executed ?? 0
    const outcomesCompleted = asl?.total_outcomes_completed ?? 0
    const packagesGenerated = result.telemetry.packagesGenerated ?? 0
    const missionBootstrapsCompleted = result.telemetry.productionMissionBootstrapsCompleted ?? 0
    const stopReason = orgResult?.stop_reason ?? asl?.skipped_reason ?? result.skippedReason

    const operatorLines = buildOperatorLines({
      organizationsExecuted,
      outcomesCompleted,
      packagesGenerated,
      missionBootstrapsCompleted,
      stopReason,
      skippedReason: result.skippedReason,
    })

    logGrowthEngine("ava_activation_immediate_production_tick_completed", {
      organization_id: input.organizationId,
      organizations_executed: organizationsExecuted,
      outcomes_completed: outcomesCompleted,
      packages_generated: packagesGenerated,
      stop_reason: stopReason,
    })

    return {
      qaMarker: GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER,
      ranAt,
      schedulerRan: true,
      organizationsExecuted,
      outcomesCompleted,
      packagesGenerated,
      missionBootstrapsCompleted,
      stopReason,
      operatorLines,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Immediate production tick failed."
    logGrowthEngine("ava_activation_immediate_production_tick_failed", {
      organization_id: input.organizationId,
      error: message,
    })

    return {
      qaMarker: GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER,
      ranAt,
      schedulerRan: false,
      organizationsExecuted: 0,
      outcomesCompleted: 0,
      packagesGenerated: 0,
      missionBootstrapsCompleted: 0,
      stopReason: null,
      operatorLines: [
        "Activation complete — I'm enabled and will begin on my next scheduled cycle (about every 20 minutes).",
        `Immediate cycle note: ${message}`,
      ],
      error: message,
    }
  }
}
