/** AVA-GROWTH-OPERATOR-1E — Operator governance for growth intelligence (client-safe). */

export const GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_GOVERNANCE_RULE =
  "Growth intelligence observes, learns, and recommends — never silently mutates ICP, messaging, budgets, providers, policies, or outbound behavior." as const

export const GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_MUTATION_POLICY = {
  recommendationOnly: true,
  requiresOperatorApproval: true,
  autoMutateIcp: false,
  autoMutateMessaging: false,
  autoMutateBudgets: false,
  autoMutateProviders: false,
  autoMutatePolicies: false,
  autoMutateOutbound: false,
} as const

export function assertGrowthIntelligenceRecommendationGovernance(input: {
  requiresOperatorApproval: boolean
  recommendationOnly: boolean
}): boolean {
  return input.requiresOperatorApproval === true && input.recommendationOnly === true
}
