export type EquipmentReliabilityLabel =
  | "stable"
  | "watch"
  | "frequent_service"
  | "repeat_failure_risk"
  | "reliability_unknown"

export type EquipmentReliabilityResult = {
  label: EquipmentReliabilityLabel
  reasons: string[]
  dataQuality: "strong" | "moderate" | "limited"
}
