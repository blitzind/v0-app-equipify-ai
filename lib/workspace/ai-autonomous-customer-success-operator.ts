/**
 * GE-AI-9B / GE-AI-ARCH-2C — Customer Growth terminology (client-safe).
 * Focus: Equipify account onboarding, adoption, expansion, renewals, advocacy — not support tickets.
 */

export const GE_AI_9B_QA_MARKER = "ge-ai-9b-autonomous-customer-success-operator-v1" as const

export const AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE = "Customer Growth Opportunities" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_MISSIONS_TITLE = AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE

export const AI_EQUIPIFY_ACCOUNT_HEALTH_TITLE = "Equipify Account Health" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_CUSTOMER_HEALTH_TITLE = AI_EQUIPIFY_ACCOUNT_HEALTH_TITLE

export const AI_CUSTOMER_GROWTH_EXPANSION_TITLE = "Expansion Opportunities" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_EXPANSION_OPPORTUNITIES_TITLE = AI_CUSTOMER_GROWTH_EXPANSION_TITLE

export const AI_EQUIPIFY_RENEWALS_TITLE = "Equipify Renewals I'm Monitoring" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_RENEWALS_MONITORING_TITLE = AI_EQUIPIFY_RENEWALS_TITLE

export const AI_ACCOUNT_WINS_TITLE = "Account Wins" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_CUSTOMER_WINS_TITLE = AI_ACCOUNT_WINS_TITLE

export const AI_CUSTOMER_GROWTH_IMPACT_TITLE = "Customer Growth Impact" as const
/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_CONTRIBUTION_TITLE = AI_CUSTOMER_GROWTH_IMPACT_TITLE

export const AI_CUSTOMER_GROWTH_LIFECYCLE_STAGES = [
  "Onboarding",
  "Adoption",
  "Health Monitoring",
  "Expansion Opportunity",
  "Renewal",
  "Advocacy",
  "Completed",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_MISSION_LIFECYCLE_STAGES = AI_CUSTOMER_GROWTH_LIFECYCLE_STAGES

export type AiCustomerGrowthLifecycleStage = (typeof AI_CUSTOMER_GROWTH_LIFECYCLE_STAGES)[number]

/** @deprecated GE-AI-ARCH-2C */
export type AiCustomerSuccessMissionLifecycleStage = AiCustomerGrowthLifecycleStage

export const AI_CUSTOMER_GROWTH_FORBIDDEN_ACTIONS = [
  "executeTransportSend",
  "Send now",
  "cron.schedule",
  "createAiWorkOrder",
] as const

/** @deprecated GE-AI-ARCH-2C */
export const AI_CS_FORBIDDEN_ACTIONS = AI_CUSTOMER_GROWTH_FORBIDDEN_ACTIONS

export function customerGrowthOperatorSummary(activeCount: number): string | null {
  if (activeCount <= 0) return null
  const noun = activeCount === 1 ? "opportunity" : "opportunities"
  return `I'm tracking ${activeCount} customer growth ${noun} across Equipify accounts.`
}

/** @deprecated GE-AI-ARCH-2C */
export function customerSuccessOperatorSummary(activeCount: number): string | null {
  return customerGrowthOperatorSummary(activeCount)
}
