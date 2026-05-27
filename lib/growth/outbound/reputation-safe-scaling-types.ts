/** Client-safe types for reputation-safe scaling (Phase 3). */

export const GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER = "growth-reputation-safe-scaling-v1" as const

export const GROWTH_DOMAIN_SEGMENTS = [
  "primary",
  "secondary",
  "experimental",
  "warming",
  "paused",
  "high_trust",
] as const
export type GrowthDomainSegment = (typeof GROWTH_DOMAIN_SEGMENTS)[number]

export const GROWTH_SCHEDULER_DECISIONS = ["execute", "defer", "skip", "throttle", "redistribute"] as const
export type GrowthSchedulerDecision = (typeof GROWTH_SCHEDULER_DECISIONS)[number]

export const GROWTH_THROUGHPUT_SATURATION_LEVELS = ["low", "normal", "elevated", "critical"] as const
export type GrowthThroughputSaturationLevel = (typeof GROWTH_THROUGHPUT_SATURATION_LEVELS)[number]

export const GROWTH_INFRASTRUCTURE_RECOMMENDATION_TYPES = [
  "reduce_volume",
  "rotate_domain",
  "pause_campaign",
  "re_enable_sender",
  "investigate_dns",
  "cooldown_sender",
  "defer_sends",
] as const
export type GrowthInfrastructureRecommendationType = (typeof GROWTH_INFRASTRUCTURE_RECOMMENDATION_TYPES)[number]

export type GrowthInfrastructureRecommendation = {
  type: GrowthInfrastructureRecommendationType
  title: string
  detail: string
  severity: "low" | "medium" | "high" | "critical"
}

export type GrowthThroughputUtilizationRow = {
  entityType: "domain" | "mailbox" | "pool"
  entityId: string | null
  label: string
  dailyLimit: number
  dailyUsed: number
  utilizationPct: number
  saturationLevel: GrowthThroughputSaturationLevel
  queueCongestion: number
}

export type GrowthExecutionCommandCenterSummary = {
  activeCampaignLoad: number
  deferredSends24h: number
  throttledPools: number
  overloadedSenders: number
  pausedDomains: number
  degradedCampaigns: number
  avgReplyQuality: number
  infrastructureRiskLevel: "low" | "medium" | "high" | "critical"
}
