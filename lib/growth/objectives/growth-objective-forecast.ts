/** GE-AUTO-1F — Objective outcome forecasting (client-safe). */

import type {
  GrowthObjective,
  GrowthObjectiveForecast,
  GrowthObjectiveIcpStrategy,
} from "@/lib/growth/objectives/growth-objective-types"

const CONVERSION_BY_TYPE: Record<GrowthObjective["objectiveType"], number> = {
  demos_booked: 0.08,
  meetings_booked: 0.1,
  opportunities_created: 0.05,
  pipeline_value: 0.03,
  customers_acquired: 0.02,
  custom: 0.06,
}

export function buildGrowthObjectiveForecast(
  objective: GrowthObjective,
  icp: GrowthObjectiveIcpStrategy,
): GrowthObjectiveForecast {
  const conversionRate = CONVERSION_BY_TYPE[objective.objectiveType]
  const remaining = Math.max(0, objective.targetValue - objective.currentValue)
  const estimatedOutcomes = remaining > 0 ? remaining : objective.targetValue

  const leadsNeeded = Math.ceil(estimatedOutcomes / Math.max(conversionRate, 0.01))
  const audienceSizeRequired = Math.ceil(leadsNeeded * 1.35)
  const assetsRequired = objective.objectiveType === "demos_booked" ? 4 : 3
  const estimatedSends = Math.ceil(leadsNeeded * 4.5)
  const estimatedDays = Math.max(14, Math.ceil(leadsNeeded / 25))

  const assumptions = [
    `Conversion heuristic ${Math.round(conversionRate * 100)}% for ${objective.objectiveType.replace(/_/g, " ")}.`,
    `ICP focus: ${icp.industries.join(", ")}.`,
    "Assumes existing suppression, budget, and autonomy policies remain enforced.",
    "Does not assume autonomous approvals — operator review may be required.",
  ]

  return {
    leadsNeeded,
    audienceSizeRequired,
    assetsRequired,
    estimatedSends,
    estimatedOutcomes,
    estimatedDays,
    assumptions,
  }
}
