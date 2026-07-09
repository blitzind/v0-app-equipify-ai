/** GE-AIOS-14A / GE-AIOS-17A — Canonical Specialist Orchestrator (routing + validation, no execution). */

import {
  applySpecialistRoutingToWorkManagerResult,
  assignSpecialistsToWorkItems,
  buildSpecialistContributions,
  buildSpecialistTeamStatus,
} from "@/lib/growth/specialists/bridges/work-manager-bridge"
import {
  completeSpecialistWork as completeSalesSpecialistWork,
  delegateWorkItem as delegateSalesSpecialistWorkItem,
  handoffBetweenSpecialists,
} from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import {
  GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
  type AvaSpecialistOrchestratorResult,
} from "@/lib/growth/specialists/types"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export type RunSpecialistOrchestratorInput = {
  workItems: AvaWorkItem[]
  workManagerResult?: AvaWorkManagerResult | null
}

export { delegateSalesSpecialistWorkItem as delegateWorkItem }
export { completeSalesSpecialistWork as completeSpecialistWork }
export { handoffBetweenSpecialists }

export function runSpecialistOrchestrator(input: RunSpecialistOrchestratorInput): AvaSpecialistOrchestratorResult {
  const routed_work_items = assignSpecialistsToWorkItems(input.workItems)
  const assignments = buildSpecialistContributions(routed_work_items)
  const team_status = buildSpecialistTeamStatus(routed_work_items, {
    workManagerResult: input.workManagerResult ?? null,
  })

  return {
    qaMarker: GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
    assignments,
    team_status,
    routed_work_items,
  }
}

export function orchestrateWorkManagerResult(result: AvaWorkManagerResult): {
  workResult: AvaWorkManagerResult
  specialistResult: AvaSpecialistOrchestratorResult
} {
  const specialistResult = runSpecialistOrchestrator({
    workItems: result.all_work_items,
    workManagerResult: result,
  })

  return {
    specialistResult,
    workResult: applySpecialistRoutingToWorkManagerResult(result, specialistResult.routed_work_items),
  }
}

export { type RunSpecialistOrchestratorInput as SpecialistOrchestratorInput }
