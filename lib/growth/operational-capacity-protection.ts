import type {
  GrowthCapacityConflict,
  GrowthOperationalCapacityTier,
  GrowthOperationalConstraint,
} from "@/lib/growth/operational-capacity-types"

export function buildCapacityProtectionRecommendation(input: {
  tier: GrowthOperationalCapacityTier
  pressureLevel: number
  constraints: GrowthOperationalConstraint[]
  conflicts: GrowthCapacityConflict[]
  isProtectedOpportunity: boolean
  protectedPipelineCoverage: number
}): string {
  if (input.tier === "critical") {
    return "Reduce new outreach — team capacity is critical. Protect only close-ready pipeline."
  }

  if (input.constraints.some((entry) => entry.key === "executive_overload")) {
    return "Redistribute executive attention — leadership load exceeds execution capacity."
  }

  if (
    input.isProtectedOpportunity &&
    (input.tier === "constrained" || input.tier === "strained")
  ) {
    return "Protect close motion — preserve capacity for this protected opportunity."
  }

  if (input.protectedPipelineCoverage < 50 && input.isProtectedOpportunity) {
    return "Execution protection recommended — protected pipeline coverage is low."
  }

  if (input.conflicts.length > 0) {
    const critical = input.conflicts.find((entry) => entry.severity === "critical")
    if (critical) {
      return `Capacity conflict: ${critical.label.toLowerCase()}.`
    }
  }

  if (input.tier === "strained") {
    return "Capacity strained — prioritize protected opportunities and defer new outreach."
  }

  return "Capacity healthy — team can absorb recommended Growth Engine actions."
}
