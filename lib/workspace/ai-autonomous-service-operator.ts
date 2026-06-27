/**
 * GE-AI-9C / GE-AI-ARCH-2C — Customer Delivery Intelligence (future vision).
 * Hidden from AI OS v1 Home by default — not field service or technician management.
 */

export const GE_AI_9C_QA_MARKER = "ge-ai-9c-autonomous-service-operator-v1" as const

export const AI_DELIVERY_INTELLIGENCE_TITLE = "Customer Delivery Intelligence" as const
/** @deprecated GE-AI-ARCH-2C — future vision; hidden in v1 */
export const AI_SERVICE_MISSIONS_TITLE = AI_DELIVERY_INTELLIGENCE_TITLE

export const AI_ONBOARDING_PIPELINE_HEALTH_TITLE = "Onboarding Pipeline Health" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_HEALTH_TITLE = AI_ONBOARDING_PIPELINE_HEALTH_TITLE

export const AI_IMPLEMENTATION_READINESS_TITLE = "Implementation Readiness" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_TECHNICIAN_AWARENESS_TITLE = AI_IMPLEMENTATION_READINESS_TITLE

export const AI_POST_SALE_FOLLOW_UPS_TITLE = "Post-Sale Follow-ups" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_FOLLOW_UPS_TITLE = AI_POST_SALE_FOLLOW_UPS_TITLE

export const AI_DELIVERY_INSIGHTS_TITLE = "Delivery Insights" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_OPERATIONAL_INSIGHTS_TITLE = AI_DELIVERY_INSIGHTS_TITLE

export const AI_DELIVERY_IMPACT_TITLE = "Delivery Impact" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_CONTRIBUTION_TITLE = AI_DELIVERY_IMPACT_TITLE

export const AI_DELIVERY_LIFECYCLE_STAGES = [
  "Onboarding",
  "Implementation",
  "Adoption",
  "Value Realized",
  "Advocacy",
  "Review Requested",
  "Closed",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_MISSION_LIFECYCLE_STAGES = AI_DELIVERY_LIFECYCLE_STAGES

export type AiDeliveryLifecycleStage = (typeof AI_DELIVERY_LIFECYCLE_STAGES)[number]

/** @deprecated GE-AI-ARCH-2C */
export type AiServiceMissionLifecycleStage = AiDeliveryLifecycleStage

export const AI_DELIVERY_FORBIDDEN_ACTIONS = [
  "Reassign technician",
  "Dispatch now",
  "executeTransportSend",
  "cron.schedule",
  "setInterval",
  "createAiWorkOrder",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_SERVICE_FORBIDDEN_ACTIONS = AI_DELIVERY_FORBIDDEN_ACTIONS

export function deliveryIntelligenceSummary(totalCount: number): string | null {
  if (totalCount <= 0) return null
  return `I'm tracking ${totalCount} Equipify onboarding ${totalCount === 1 ? "journey" : "journeys"}.`
}

/** @deprecated GE-AI-ARCH-2C */
export function serviceOperatorSummary(totalCount: number): string | null {
  return deliveryIntelligenceSummary(totalCount)
}
