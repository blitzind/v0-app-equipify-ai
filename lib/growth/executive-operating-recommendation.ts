import type {
  GrowthExecutivePriorityTier,
  GrowthIntelligenceConflict,
} from "@/lib/growth/executive-operating-types"

export function buildExecutiveRecommendation(input: {
  tier: GrowthExecutivePriorityTier
  conflicts: GrowthIntelligenceConflict[]
  interventionNeeded: boolean
  closeCandidate: boolean
}): string {
  if (input.tier === "executive_now") {
    if (input.interventionNeeded) {
      return "Executive takeover recommended — commit regression or critical conflict requires leadership intervention."
    }
    if (input.closeCandidate) {
      return "Executive takeover recommended — close candidate needs immediate leadership focus."
    }
    return "Executive takeover recommended — highest-priority account for leadership focus now."
  }

  if (input.interventionNeeded) {
    return "Executive intervention recommended — address forecast regression on a commit candidate."
  }

  if (input.tier === "priority") {
    const critical = input.conflicts.find((conflict) => conflict.severity === "critical")
    if (critical) {
      return `Priority review recommended — resolve ${critical.label.toLowerCase()}.`
    }
    return "Priority review recommended — leadership should monitor this account closely."
  }

  if (input.tier === "important") {
    return "Important account — assign owner attention and monitor cross-signal conflicts."
  }

  if (input.conflicts.length > 0) {
    return "Monitor intelligence conflicts — no immediate executive action required."
  }

  return "Monitor — executive operating signals are stable."
}
