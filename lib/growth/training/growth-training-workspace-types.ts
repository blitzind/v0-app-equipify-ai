/** GE-AIOS-19C-2E — Training workspace types and routes (client-safe). */

export const GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER = "ge-aios-19c-training-workspace-v1" as const

export const GROWTH_TRAINING_WORKSPACE_ROUTE = "/growth/training" as const

export const GROWTH_TRAINING_OVERVIEW_ROUTE = "/growth/training" as const
export const GROWTH_TRAINING_COMPANY_PROFILE_ROUTE = "/growth/training/company-profile" as const
export const GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE = "/growth/training/business-strategy" as const
export const GROWTH_TRAINING_RUNBOOK_ROUTE = "/growth/training/runbook" as const
export const GROWTH_TRAINING_LEARNED_ROUTE = "/growth/training/learned" as const
export const GROWTH_TRAINING_CONVERSATION_REVIEW_ROUTE = "/growth/training/conversation-review" as const
export const GROWTH_TRAINING_TEACHING_SESSIONS_ROUTE = "/growth/training/teaching-sessions" as const
export const GROWTH_TRAINING_IMPORTS_ROUTE = "/growth/training/imports" as const

export const GROWTH_TRAINING_COMPANY_PROFILE_TITLE = "Company Profile" as const
export const GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE = "Business Strategy" as const
export const GROWTH_TRAINING_RUNBOOK_TITLE = "Runbook" as const
export const GROWTH_TRAINING_LEARNED_TITLE = "What I've Learned" as const

export const GROWTH_TRAINING_WORKSPACE_TITLE = "Training" as const
export const GROWTH_TRAINING_WORKSPACE_DESCRIPTION =
  "Teach your AI teammate who you are, how you sell, and how you want outreach prepared before approval." as const

export const GROWTH_TRAINING_OVERVIEW_TITLE = "Overview" as const

export const GROWTH_TRAINING_SAVE_SUCCESS_COPY =
  "I've updated what I know about your business." as const
export const GROWTH_TRAINING_STRATEGY_SAVE_SUCCESS_COPY =
  "I'll use this strategy going forward." as const

export type GrowthTrainingAreaStatus = "complete" | "in_progress" | "not_started" | "available"

export type GrowthTrainingOverviewArea = {
  id: "company_profile" | "business_strategy" | "runbook" | "learned"
  label: string
  status: GrowthTrainingAreaStatus
  summary: string
  href: string
  coachingHint: string | null
}

export type GrowthTrainingOverviewReadModel = {
  qaMarker: typeof GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER
  headline: string
  subheadline: string | null
  wellUnderstood: string[]
  needsCoaching: string[]
  recommendedNextAction: {
    label: string
    href: string
    reason: string
  } | null
  areas: GrowthTrainingOverviewArea[]
  confidenceNote: string | null
}
