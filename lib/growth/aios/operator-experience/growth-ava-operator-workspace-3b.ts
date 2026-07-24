/**
 * AVA-OPERATOR-WORKSPACE-3B — Drawer layout: Ava review vs CRM reference (client-safe).
 */

import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"

export const GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER =
  "ava-operator-workspace-3b-v1" as const

export const GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION = "Recommendation" as const
export const GROWTH_AVA_OPERATOR_SECTION_WHY = "Why Ava recommends this" as const
export const GROWTH_AVA_OPERATOR_SECTION_PREPARED_EMAIL = "Prepared Email" as const
export const GROWTH_AVA_OPERATOR_SECTION_YOUR_DECISION = "Your Decision" as const
export const GROWTH_AVA_OPERATOR_SECTION_RECOMMENDATION_STATUS = "Recommendation" as const
export const GROWTH_AVA_OPERATOR_SECTION_ESTIMATED_REVIEW_TIME = "Estimated review time" as const
export const GROWTH_AVA_OPERATOR_DRAWER_REFERENCE_DIVIDER_LABEL = "Reference Information" as const

export const GROWTH_AVA_OPERATOR_REFERENCE_SECTION_TITLES = {
  contact: "Contact information",
  companyDetails: "Company Details",
  progress: "Progress",
  evidence: "Evidence",
  activity: "Activity",
  research: "Research",
  operations: "Operations",
  advanced: "Advanced",
} as const

export function formatOperatorRecommendationStatusLabel(input: {
  confidenceLabel: string
  reviewStatusLabel: string
}): { recommendationLabel: string; reviewLabel: string } {
  return {
    recommendationLabel: input.confidenceLabel,
    reviewLabel: input.reviewStatusLabel,
  }
}

export function estimateOperatorReviewTimeLabel(generation: GrowthAiCopilotGeneration): string {
  const bodyChars = generation.generatedContent?.trim().length ?? 0
  const subjectChars = generation.generatedSubject?.trim().length ?? 0
  const total = bodyChars + subjectChars

  if (total <= 400) return "≈20 seconds"
  if (total <= 900) return "≈30 seconds"
  if (total <= 1600) return "≈45 seconds"
  return "≈1 minute"
}
