/** Client-safe Growth Engine lead aging types. */

export const GROWTH_LEAD_AGING_BUCKETS = ["new", "warming", "active", "aging", "critical"] as const

export type GrowthLeadAgingBucket = (typeof GROWTH_LEAD_AGING_BUCKETS)[number]

export type GrowthLeadAgingResult = {
  agingDays: number
  agingBucket: GrowthLeadAgingBucket
}

export function computeGrowthLeadAging(createdAt: string, now: Date = new Date()): GrowthLeadAgingResult {
  const created = new Date(createdAt)
  const agingDays = Number.isNaN(created.getTime())
    ? 0
    : Math.max(0, Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)))

  let agingBucket: GrowthLeadAgingBucket
  if (agingDays <= 7) agingBucket = "new"
  else if (agingDays <= 21) agingBucket = "warming"
  else if (agingDays <= 45) agingBucket = "active"
  else if (agingDays <= 90) agingBucket = "aging"
  else agingBucket = "critical"

  return { agingDays, agingBucket }
}
