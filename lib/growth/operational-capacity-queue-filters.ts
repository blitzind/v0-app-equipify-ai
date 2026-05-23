import type {
  GrowthOperationalCapacityQueueFilter,
  GrowthOperationalCapacityTier,
} from "@/lib/growth/operational-capacity-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type OperationalCapacityQueueFilterRow = {
  status: GrowthLeadStatus
  operationalCapacityScore: number | null
  operationalCapacityTier: GrowthOperationalCapacityTier | null
  capacityPressureLevel: number
  operationalConstraintKeys: string[]
  operationalConstraintCount: number
  isProtectedOpportunity: boolean
  capacityConflictCount: number
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesOperationalCapacityQueueFilter(
  filter: GrowthOperationalCapacityQueueFilter,
  row: OperationalCapacityQueueFilterRow,
): boolean {
  if (TERMINAL.has(row.status)) return false
  const constraintKeys = new Set(row.operationalConstraintKeys)

  switch (filter) {
    case "capacity_risk":
      return (
        row.operationalCapacityTier === "constrained" ||
        row.operationalCapacityTier === "critical" ||
        row.capacityConflictCount > 0
      )
    case "executive_overload":
      return constraintKeys.has("executive_overload")
    case "protected_opportunities":
      return row.isProtectedOpportunity
    case "constraint_pressure":
      return row.capacityPressureLevel >= 60 || row.operationalConstraintCount >= 2
    default:
      return false
  }
}

export function isGrowthOperationalCapacityCallQueueFilter(
  value: string,
): value is GrowthOperationalCapacityQueueFilter {
  return ["capacity_risk", "executive_overload", "protected_opportunities", "constraint_pressure"].includes(
    value,
  )
}
