/** Client-safe Growth Engine post-close revenue / customer lifecycle types (slice 6.25A). */

export const GROWTH_POST_CLOSE_REVENUE_QA_MARKER = "post-close-revenue-v1" as const

export const GROWTH_CUSTOMER_LIFECYCLE_STAGES = [
  "onboarding_pending",
  "onboarding_active",
  "activated",
  "healthy",
  "expansion_candidate",
  "renewal_due",
  "churn_risk",
  "inactive",
] as const
export type GrowthCustomerLifecycleStage = (typeof GROWTH_CUSTOMER_LIFECYCLE_STAGES)[number]

export const GROWTH_CUSTOMER_ONBOARDING_STATUSES = ["pending", "active", "completed"] as const
export type GrowthCustomerOnboardingStatus = (typeof GROWTH_CUSTOMER_ONBOARDING_STATUSES)[number]

export const GROWTH_CUSTOMER_REVIEW_STATUSES = [
  "none",
  "review_pending",
  "review_requested",
  "review_received",
] as const
export type GrowthCustomerReviewStatus = (typeof GROWTH_CUSTOMER_REVIEW_STATUSES)[number]

export const GROWTH_CUSTOMER_REFERRAL_STATUSES = [
  "none",
  "referral_eligible",
  "referral_requested",
  "referral_received",
] as const
export type GrowthCustomerReferralStatus = (typeof GROWTH_CUSTOMER_REFERRAL_STATUSES)[number]

export const GROWTH_CUSTOMER_ONBOARDING_TASK_KEYS = [
  "kickoff_meeting",
  "account_setup",
  "training_complete",
  "implementation_complete",
  "first_success_milestone",
  "onboarding_review",
] as const
export type GrowthCustomerOnboardingTaskKey = (typeof GROWTH_CUSTOMER_ONBOARDING_TASK_KEYS)[number]

export const GROWTH_CUSTOMER_ONBOARDING_TASK_STATUSES = ["open", "completed", "skipped"] as const
export type GrowthCustomerOnboardingTaskStatus =
  (typeof GROWTH_CUSTOMER_ONBOARDING_TASK_STATUSES)[number]

export const GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS = [
  "onboarding",
  "healthy",
  "renewals",
  "expansion",
  "churn_risk",
  "reviews",
  "referrals",
  "all",
] as const
export type GrowthCustomerLifecycleInboxView = (typeof GROWTH_CUSTOMER_LIFECYCLE_INBOX_VIEWS)[number]

export const GROWTH_CUSTOMER_LIFECYCLE_STAGE_LABELS: Record<GrowthCustomerLifecycleStage, string> = {
  onboarding_pending: "Onboarding Pending",
  onboarding_active: "Onboarding Active",
  activated: "Activated",
  healthy: "Healthy",
  expansion_candidate: "Expansion Candidate",
  renewal_due: "Renewal Due",
  churn_risk: "Churn Risk",
  inactive: "Inactive",
}

export const GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS: Record<GrowthCustomerOnboardingTaskKey, string> = {
  kickoff_meeting: "Kickoff Meeting",
  account_setup: "Account Setup",
  training_complete: "Training Complete",
  implementation_complete: "Implementation Complete",
  first_success_milestone: "First Success Milestone",
  onboarding_review: "Onboarding Review",
}

export type GrowthCustomerProfile = {
  id: string
  leadId: string
  opportunityId: string
  organizationId: string | null
  ownerUserId: string | null
  companyName: string
  lifecycleStage: GrowthCustomerLifecycleStage
  onboardingStatus: GrowthCustomerOnboardingStatus
  closedWonAt: string
  activationAt: string | null
  firstValueAt: string | null
  healthScore: number
  expansionScore: number
  renewalDate: string | null
  renewalWindowOpen: boolean
  lastEngagementAt: string | null
  reviewStatus: GrowthCustomerReviewStatus
  referralStatus: GrowthCustomerReferralStatus
  reviewRequestedAt: string | null
  reviewReceivedAt: string | null
  referralRequestedAt: string | null
  referralReceivedAt: string | null
  expansionOpportunityCount: number
  churnIndicators: string[]
  createdAt: string
  updatedAt: string
  openOnboardingTaskCount?: number
}

export type GrowthCustomerOnboardingTask = {
  id: string
  customerProfileId: string
  ownerUserId: string | null
  taskKey: GrowthCustomerOnboardingTaskKey
  title: string
  instructions: string
  dueAt: string | null
  status: GrowthCustomerOnboardingTaskStatus
  outcome: string | null
  skippedReason: string | null
  completedAt: string | null
  completedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthCustomerLifecycleDashboard = {
  qaMarker: typeof GROWTH_POST_CLOSE_REVENUE_QA_MARKER
  onboardingPipelineCount: number
  healthyCount: number
  renewalUpcomingCount: number
  renewalOverdueCount: number
  expansionCandidateCount: number
  churnRiskCount: number
  reviewPendingCount: number
  referralEligibleCount: number
  ownerWorkload: Array<{ ownerUserId: string | null; count: number }>
  lifecycleStageDistribution: Array<{ stage: GrowthCustomerLifecycleStage; count: number }>
  healthDistribution: Array<{ band: string; count: number }>
}

export type GrowthCustomerLifecycleCommandSummary = {
  qaMarker: typeof GROWTH_POST_CLOSE_REVENUE_QA_MARKER
  renewalsDueCount: number
  expansionCandidatesCount: number
  churnRisksCount: number
  reviewOpportunitiesCount: number
  referralOpportunitiesCount: number
}
