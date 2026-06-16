/** Growth Engine S2-I — AI Q&A answer policy definitions (static metadata, no execution). Client-safe. */

export const GROWTH_MEDIA_AI_QA_POLICY_QA_MARKER = "growth-media-ai-qa-policy-s2i-v1" as const

export type GrowthMediaAiQaAnswerPolicyDefinition = {
  policyId: string
  name: string
  allowedTopics: string[]
  blockedTopics: string[]
  fallbackResponse: string
  requiresHumanReview: boolean
  allowBookingRecommendation: boolean
  allowPricingAnswers: boolean
  allowCompetitorAnswers: boolean
  maxAnswerLength: number
  tone: "professional" | "consultative" | "friendly" | "executive"
}

export const GROWTH_MEDIA_AI_QA_POLICY_CATALOG: GrowthMediaAiQaAnswerPolicyDefinition[] = [
  {
    policyId: "qa-policy-safe-default",
    name: "Safe default (human review required)",
    allowedTopics: ["product_overview", "use_cases", "implementation", "booking", "qualification"],
    blockedTopics: ["pricing", "competitors", "legal", "security_claims"],
    fallbackResponse:
      "Thanks for your question. A member of our team will follow up with a precise answer shortly.",
    requiresHumanReview: true,
    allowBookingRecommendation: true,
    allowPricingAnswers: false,
    allowCompetitorAnswers: false,
    maxAnswerLength: 600,
    tone: "professional",
  },
  {
    policyId: "qa-policy-share-page-guided",
    name: "Share page guided Q&A",
    allowedTopics: ["share_page_content", "personalization", "booking", "next_steps"],
    blockedTopics: ["pricing", "competitors", "unsupported_claims"],
    fallbackResponse:
      "I can help with the overview on this page. For specifics, we'll connect you with {{sender.name}} at {{sender.company}}.",
    requiresHumanReview: true,
    allowBookingRecommendation: true,
    allowPricingAnswers: false,
    allowCompetitorAnswers: false,
    maxAnswerLength: 500,
    tone: "consultative",
  },
  {
    policyId: "qa-policy-qualification-bridge",
    name: "Qualification bridge",
    allowedTopics: ["qualification", "fit", "timeline", "stakeholders", "booking"],
    blockedTopics: ["pricing", "competitors", "contract_terms"],
    fallbackResponse:
      "Great question. Let's confirm a few details first, then we can recommend the best next step for {{prospect.name}} at {{company.name}}.",
    requiresHumanReview: true,
    allowBookingRecommendation: true,
    allowPricingAnswers: false,
    allowCompetitorAnswers: false,
    maxAnswerLength: 450,
    tone: "friendly",
  },
]

export function getQaPolicyById(policyId: string | null | undefined): GrowthMediaAiQaAnswerPolicyDefinition | null {
  const trimmed = policyId?.trim()
  if (!trimmed) return null
  return GROWTH_MEDIA_AI_QA_POLICY_CATALOG.find((policy) => policy.policyId === trimmed) ?? null
}

export function validateQaPolicy(policyId: string | null | undefined): boolean {
  return getQaPolicyById(policyId) != null
}

export function listEnabledQaPolicies(): GrowthMediaAiQaAnswerPolicyDefinition[] {
  return GROWTH_MEDIA_AI_QA_POLICY_CATALOG
}
