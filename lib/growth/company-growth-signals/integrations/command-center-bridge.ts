import type { GrowthSignalTier } from "@/lib/growth/company-growth-signals/company-growth-signal-types"

export function growthSignalActionImpactBoost(input: {
  growthSignalScore?: number | null
  signalTier?: GrowthSignalTier | null
}): number {
  let boost = 0
  if ((input.growthSignalScore ?? 0) >= 80) boost += 6
  else if ((input.growthSignalScore ?? 0) >= 60) boost += 4
  else if ((input.growthSignalScore ?? 0) >= 35) boost += 2

  if (input.signalTier === "urgent") boost += 4
  else if (input.signalTier === "high") boost += 2

  return boost
}

export function growthSignalInboxIntentBoost(score: number | null | undefined): number {
  if (score == null) return 0
  if (score >= 80) return 18
  if (score >= 60) return 12
  if (score >= 35) return 6
  return 0
}

export function growthSignalInboxPriority(
  tier: GrowthSignalTier | null | undefined,
): "urgent" | "high" | "normal" | "low" {
  if (tier === "urgent") return "urgent"
  if (tier === "high") return "high"
  if (tier === "moderate") return "normal"
  return "low"
}
