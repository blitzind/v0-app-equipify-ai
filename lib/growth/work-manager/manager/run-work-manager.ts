/** GE-AIOS-11A — Canonical Work Manager orchestrator (deterministic, no execution). */

import { runDecisionEngine, type RunDecisionEngineInput } from "@/lib/growth/decision-engine/engine/run-decision-engine"
import { nextBestActionsToWorkItems } from "@/lib/growth/work-manager/bridges/decision-engine-bridge"
import {
  buildCompletedWorkItems,
  buildDailyWorkPlan,
} from "@/lib/growth/work-manager/planner/build-daily-work-plan"
import { GROWTH_WORK_MANAGER_QA_MARKER, type AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type { BuildWorkContextInput } from "@/lib/growth/work-manager/context/build-work-context"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { orchestrateWorkManagerResult } from "@/lib/growth/specialists/engine/run-specialist-orchestrator"

export type RunWorkManagerInput = BuildWorkContextInput & {
  memorySummary?: AvaMemorySummary | null
}

/** Future autonomy hook — NOT implemented in 11A. */
export function executeReadyWorkItems(_result: AvaWorkManagerResult): {
  executed: false
  reason: "autonomy_not_enabled"
} {
  return { executed: false, reason: "autonomy_not_enabled" }
}

export function runWorkManager(input: RunWorkManagerInput): AvaWorkManagerResult {
  const timestamp = input.generatedAt ?? new Date().toISOString()
  const decisionResult = runDecisionEngine({
    ...input,
    memorySummary: input.memorySummary ?? null,
  })
  const workItems = nextBestActionsToWorkItems(decisionResult.next_best_actions, timestamp)
  const completedToday = buildCompletedWorkItems(
    input.accomplishments,
    input.workspaceSummary.avaConsole.researchLoopSummary,
    timestamp,
  )

  const plan = buildDailyWorkPlan({ workItems, completedToday })
  const baseResult: AvaWorkManagerResult = {
    qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
    ...plan,
    completed_today: completedToday,
  }
  const { workResult, specialistResult } = orchestrateWorkManagerResult(baseResult)

  return {
    ...workResult,
    specialist_orchestrator_qa_marker: specialistResult.qaMarker,
    specialist_orchestrator_result: specialistResult,
  }
}

export type { BuildWorkContextInput } from "@/lib/growth/work-manager/context/build-work-context"
