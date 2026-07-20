/** GE-AIOS-LIVE-2A — Autonomous production mission bootstrap selectors (client-safe). */

import { GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"
import { isMissionRuntimeOrchestrationReady } from "@/lib/growth/mission-center/growth-mission-runtime-orchestration-readiness"
import { selectAcquisitionMission } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { readCanonicalObjectiveMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  GE_AIOS_LIVE_2A_PRODUCTION_MISSION_OBJECTIVE,
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a-types"
import { shouldPortfolioManagerTriggerDiscovery } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a"
import type { GrowthPortfolioHealthReadModel } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"

const ACQUISITION_OBJECTIVE_TYPES = new Set([
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
  "opportunities_created",
  "pipeline_value",
  "demos_booked",
  "meetings_booked",
])

export function isProductionAcquisitionObjective(objective: GrowthObjective): boolean {
  const purpose = readCanonicalObjectiveMissionPurpose(objective.executionContext) ?? "production"
  if (purpose !== "production") return false
  return ACQUISITION_OBJECTIVE_TYPES.has(objective.objectiveType)
}

export function selectCanonicalProductionBootstrapObjective(
  objectives: GrowthObjective[],
  preferredTitle?: string | null,
): GrowthObjective | null {
  const productionObjectives = objectives.filter(isProductionAcquisitionObjective)
  if (productionObjectives.length === 0) return null

  const normalizedPreferredTitle = preferredTitle?.trim().toLowerCase()
  if (normalizedPreferredTitle) {
    const titleMatch = productionObjectives.find(
      (row) => row.title.trim().toLowerCase() === normalizedPreferredTitle,
    )
    if (titleMatch) return titleMatch
  }

  return selectAcquisitionMission(productionObjectives) ?? productionObjectives[0] ?? null
}

export function findActiveProductionBootstrapMission(objectives: GrowthObjective[]): GrowthObjective | null {
  return (
    objectives.find(
      (row) =>
        isProductionAcquisitionObjective(row) &&
        row.status === "active" &&
        row.runtime?.running === true &&
        !row.emergencyStopActive,
    ) ?? null
  )
}

export function isProductionBootstrapMissionReady(objective: GrowthObjective): boolean {
  return isProductionAcquisitionObjective(objective) && isMissionRuntimeOrchestrationReady(objective)
}

export function evaluateProductionMissionBootstrapRequirement(input: {
  approvedProfilePresent: boolean
  portfolioHealth: Pick<GrowthPortfolioHealthReadModel, "needsCount" | "approvedProfilePresent"> | null
  autonomyEnabled: boolean
  objectiveModeEnabled: boolean
  activeProductionMission: GrowthObjective | null
  bootstrapMissionReady: boolean
}): { required: boolean; portfolioDeficit: number; reason: string | null } {
  const portfolioDeficit = Math.max(0, input.portfolioHealth?.needsCount ?? 0)

  if (!input.autonomyEnabled) {
    return { required: false, portfolioDeficit, reason: "autonomy_disabled" }
  }
  if (!input.objectiveModeEnabled) {
    return { required: false, portfolioDeficit, reason: "objective_mode_disabled" }
  }
  if (!input.approvedProfilePresent) {
    return { required: false, portfolioDeficit, reason: "approved_profile_missing" }
  }
  if (!input.portfolioHealth || !shouldPortfolioManagerTriggerDiscovery(input.portfolioHealth)) {
    return { required: false, portfolioDeficit, reason: "portfolio_healthy" }
  }
  if (input.bootstrapMissionReady) {
    return { required: false, portfolioDeficit, reason: "production_mission_ready" }
  }

  return { required: true, portfolioDeficit, reason: "portfolio_below_target_without_active_mission" }
}

export {
  GE_AIOS_LIVE_2A_PRODUCTION_MISSION_OBJECTIVE,
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
}
