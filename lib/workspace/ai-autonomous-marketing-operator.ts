/**
 * GE-AI-9A / GE-AI-ARCH-2C — Growth Operator terminology (client-safe).
 * Growth Initiatives help sell Equipify — SEO, ads, content, ICP, campaigns.
 */

export const GE_AI_9A_QA_MARKER = "ge-ai-9a-autonomous-marketing-operator-v1" as const

export const AI_GROWTH_INITIATIVES_TITLE = "Growth Initiatives" as const
/** @deprecated GE-AI-ARCH-2C — use AI_GROWTH_INITIATIVES_TITLE */
export const AI_MARKETING_MISSIONS_TITLE = AI_GROWTH_INITIATIVES_TITLE

export const AI_GROWTH_CAMPAIGN_PERFORMANCE_TITLE = "Campaign Performance" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_CAMPAIGN_PERFORMANCE_TITLE = AI_GROWTH_CAMPAIGN_PERFORMANCE_TITLE

export const AI_GROWTH_CONTENT_PREPARING_TITLE = "Content I'm Preparing" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_CONTENT_PREPARING_TITLE = AI_GROWTH_CONTENT_PREPARING_TITLE

export const AI_GROWTH_AUDIENCE_INTELLIGENCE_TITLE = "Audience Intelligence" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_AUDIENCE_INTELLIGENCE_TITLE = AI_GROWTH_AUDIENCE_INTELLIGENCE_TITLE

export const AI_GROWTH_IMPACT_TITLE = "Growth Impact" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_CONTRIBUTION_TITLE = AI_GROWTH_IMPACT_TITLE

export const AI_GROWTH_INITIATIVE_LIFECYCLE_STAGES = [
  "Planning",
  "Content",
  "Creative",
  "Audience",
  "Campaign",
  "Launch Ready",
  "Running",
  "Learning",
  "Improving",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_MISSION_LIFECYCLE_STAGES = AI_GROWTH_INITIATIVE_LIFECYCLE_STAGES

export type AiGrowthInitiativeLifecycleStage = (typeof AI_GROWTH_INITIATIVE_LIFECYCLE_STAGES)[number]

/** @deprecated GE-AI-ARCH-2C */
export type AiMarketingMissionLifecycleStage = AiGrowthInitiativeLifecycleStage

export const AI_GROWTH_FORBIDDEN_ACTIONS = [
  "Launch campaign",
  "Send now",
  "executeTransportSend",
  "cron.schedule",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_MARKETING_FORBIDDEN_ACTIONS = AI_GROWTH_FORBIDDEN_ACTIONS

export function growthOperatorSummary(activeCount: number): string | null {
  if (activeCount <= 0) return null
  const noun = activeCount === 1 ? "initiative" : "initiatives"
  return `I'm running ${activeCount} growth ${noun} to sell Equipify.`
}

/** @deprecated GE-AI-ARCH-2C */
export function marketingOperatorSummary(activeCount: number): string | null {
  return growthOperatorSummary(activeCount)
}
