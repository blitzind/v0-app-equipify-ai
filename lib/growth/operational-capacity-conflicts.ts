import type {
  GrowthCapacityConflict,
  GrowthLeadOperationalCapacityInput,
  GrowthOperationalCapacityPlatformSnapshot,
  GrowthOperationalConstraint,
} from "@/lib/growth/operational-capacity-types"

export function detectCapacityConflicts(input: {
  snapshot: GrowthOperationalCapacityPlatformSnapshot
  constraints: GrowthOperationalConstraint[]
  lead: GrowthLeadOperationalCapacityInput
  pressureLevel: number
  tier: import("@/lib/growth/operational-capacity-types").GrowthOperationalCapacityTier
  isProtectedOpportunity: boolean
}): GrowthCapacityConflict[] {
  const conflicts: GrowthCapacityConflict[] = []
  const constraintKeys = new Set(input.constraints.map((entry) => entry.key))

  if (
    input.snapshot.executiveNowCount >= 4 &&
    (input.snapshot.interventionAgingCount > 0 || input.snapshot.interventionStalledCount > 0)
  ) {
    conflicts.push({
      key: "executive_now_intervention_aging",
      label: "Executive now count high with aging interventions",
      severity: "critical",
    })
  }

  if (
    (input.snapshot.priorityOpportunityCount >= 6 || input.lead.revenueProbabilityTier === "forecasted") &&
    constraintKeys.has("leadership_capacity_limit")
  ) {
    conflicts.push({
      key: "high_forecast_leadership_bottleneck",
      label: "High forecast volume with leadership bottlenecks",
      severity: "critical",
    })
  }

  if (
    input.snapshot.hotOpportunityCount >= 6 &&
    (input.tier === "constrained" || input.tier === "critical")
  ) {
    conflicts.push({
      key: "hot_opportunities_low_capacity",
      label: "Hot opportunities exceed available capacity",
      severity: "critical",
    })
  }

  if (
    input.snapshot.protectedPipelineCount >= 4 &&
    constraintKeys.has("executive_overload")
  ) {
    conflicts.push({
      key: "commit_candidate_executive_overload",
      label: "Protected pipeline under executive overload",
      severity: "critical",
    })
  }

  if (input.isProtectedOpportunity && input.tier === "critical") {
    conflicts.push({
      key: "protected_pipeline_capacity_risk",
      label: "Protected opportunity at critical capacity",
      severity: "warning",
    })
  }

  return conflicts
}
