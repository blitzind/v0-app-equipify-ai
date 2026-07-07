/** GE-AVA-MISSION-CENTER-1A — Mission health aggregation (reuses existing signals). */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type {
  GrowthMissionCenterCard,
  GrowthMissionCenterHealth,
  GrowthMissionCenterHealthSummary,
} from "@/lib/growth/mission-center/growth-mission-center-types"
import { computeObjectiveDashboardProgress } from "@/lib/growth/objectives/growth-objective-stage-state-machine"
import type { AiRevenueMissionHealthState } from "@/lib/workspace/ai-autonomous-revenue-operator"

const HEALTH_LABELS: Record<GrowthMissionCenterHealth, string> = {
  healthy: "Healthy",
  needs_attention: "Needs Attention",
  blocked: "Blocked",
  waiting_on_you: "Waiting on You",
  completed: "Completed",
}

export function resolveObjectiveMissionHealth(
  objective: GrowthObjective,
  businessProfileApproved: boolean,
  pendingApprovalCount: number,
): GrowthMissionCenterHealth {
  if (objective.status === "completed") return "completed"
  if (!businessProfileApproved) return "blocked"
  if (objective.emergencyStopActive || objective.status === "paused") return "blocked"
  const currentStage = objective.runtime?.currentStageId
  const stageState = currentStage ? objective.runtime?.stageStates[currentStage] : null
  if (stageState?.state === "blocked" || stageState?.state === "failed") return "blocked"
  if (pendingApprovalCount > 0 && (currentStage === "generate_assets" || currentStage === "launch")) {
    return "waiting_on_you"
  }
  if (objective.recommendations.length > 0) return "needs_attention"
  if (objective.status === "planning" || !objective.runtime?.running) return "needs_attention"
  return "healthy"
}

export function mapRevenueHealthToMissionHealth(
  health: AiRevenueMissionHealthState,
): GrowthMissionCenterHealth {
  switch (health) {
    case "completed":
      return "completed"
    case "blocked":
      return "blocked"
    case "needs_review":
      return "waiting_on_you"
    case "waiting":
      return "needs_attention"
    default:
      return "healthy"
  }
}

export function buildMissionCenterHealthSummary(
  missions: GrowthMissionCenterCard[],
): GrowthMissionCenterHealthSummary[] {
  const counts = new Map<GrowthMissionCenterHealth, number>()
  for (const mission of missions) {
    counts.set(mission.health, (counts.get(mission.health) ?? 0) + 1)
  }
  return (["healthy", "needs_attention", "blocked", "waiting_on_you", "completed"] as GrowthMissionCenterHealth[])
    .map((health) => ({
      health,
      count: counts.get(health) ?? 0,
      label: HEALTH_LABELS[health],
    }))
    .filter((row) => row.count > 0)
}

export function objectiveProgressPercent(objective: GrowthObjective): number {
  return computeObjectiveDashboardProgress(objective)
}

export { HEALTH_LABELS as GROWTH_MISSION_CENTER_HEALTH_LABELS }
