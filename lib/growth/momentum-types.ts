/** Client-safe Growth Engine momentum types. */

export const GROWTH_MOMENTUM_TIERS = ["low", "medium", "high", "critical"] as const

export type GrowthMomentumTier = (typeof GROWTH_MOMENTUM_TIERS)[number]

export type GrowthMomentumResult = {
  score: number
  tier: GrowthMomentumTier
  whySummary: string
}
