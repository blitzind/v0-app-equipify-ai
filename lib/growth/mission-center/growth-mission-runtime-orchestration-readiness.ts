/** GE-AIOS-18G — Mission runtime orchestration readiness (client-safe). */

import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import type { GrowthObjective, GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"

const MONITOR_LOOP_STAGES: GrowthObjectiveStageId[] = ["monitor", "adapt", "book"]

/** True when existing scheduler/orchestrator may run discovery, import, and monitoring. */
export function isMissionRuntimeOrchestrationReady(objective: GrowthObjective): boolean {
  const launch = objective.runtime?.stageStates.launch
  if (launch?.state === "completed") return true
  if (MONITOR_LOOP_STAGES.includes(objective.runtime?.currentStageId ?? "discover")) return true

  const missionRuntime = objective.executionContext?.missionRuntime
  if (missionRuntime?.qa_marker !== GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return false

  return (
    missionRuntime.approved === true &&
    Boolean(
      missionRuntime.datamoon?.importRequestJson?.trim() || missionRuntime.audience?.audienceId,
    )
  )
}
