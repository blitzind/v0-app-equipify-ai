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
import {
  applyPortfolioEligibilityToWorkManagerResult,
  buildPortfolioEligibilityContext,
  filterPortfolioEligibleWorkItems,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"

export type RunWorkManagerInput = BuildWorkContextInput & {
  memorySummary?: AvaMemorySummary | null
  organizationId?: string | null
  portfolioLeads?: import("@/lib/growth/types").GrowthLead[] | null
}

export type ExecuteReadyWorkItemsResult =
  | {
      executed: false
      reason:
        | "autonomy_not_enabled"
        | "no_executable_work"
        | "daily_budget_exhausted"
        | "max_iterations_reached"
        | "autonomy_disabled"
        | "context_unavailable"
    }
  | {
      executed: true
      reason: "loop_completed"
      iterations: number
      outcomes_completed: number
      qa_marker?: string
    }

/** GE-AIOS-18A — Client-safe passthrough; server loop supplies loopResult. */
export function executeReadyWorkItems(
  _result: AvaWorkManagerResult,
  options?: {
    loopResult?: ExecuteReadyWorkItemsResult | null
  },
): ExecuteReadyWorkItemsResult {
  if (options?.loopResult) return options.loopResult
  return { executed: false, reason: "autonomy_not_enabled" }
}

export function runWorkManager(input: RunWorkManagerInput): AvaWorkManagerResult {
  const timestamp = input.generatedAt ?? new Date().toISOString()
  const portfolioEligibility =
    input.organizationId && input.portfolioLeads
      ? buildPortfolioEligibilityContext(input.organizationId, input.portfolioLeads)
      : null
  const decisionResult = runDecisionEngine({
    ...input,
    memorySummary: input.memorySummary ?? null,
    portfolioEligibility,
    portfolioLeads: input.portfolioLeads ?? null,
  })
  const workItems = filterPortfolioEligibleWorkItems(
    nextBestActionsToWorkItems(decisionResult.next_best_actions, timestamp),
    portfolioEligibility,
  )
  const completedToday = buildCompletedWorkItems(
    input.accomplishments,
    input.workspaceSummary.avaConsole.researchLoopSummary,
    timestamp,
  )

  const leadsById = new Map((input.portfolioLeads ?? []).map((lead) => [lead.id, lead]))
  const plan = buildDailyWorkPlan({
    workItems,
    completedToday,
    leadsById,
    generatedAt: timestamp,
    organizationId: input.organizationId ?? null,
  })
  const baseResult: AvaWorkManagerResult = {
    qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
    ...plan,
    completed_today: completedToday,
  }
  const { workResult, specialistResult } = orchestrateWorkManagerResult(baseResult)
  const eligibleWorkResult = applyPortfolioEligibilityToWorkManagerResult(workResult, portfolioEligibility)

  return {
    ...eligibleWorkResult,
    specialist_orchestrator_qa_marker: specialistResult.qaMarker,
    specialist_orchestrator_result: specialistResult,
  }
}

export type { BuildWorkContextInput } from "@/lib/growth/work-manager/context/build-work-context"
