import type { GrowthCustomerLifecycleStage } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

export type CustomerHealthScoreInput = {
  lastEngagementAt: string | null
  activationAt: string | null
  firstValueAt: string | null
  onboardingCompleted: boolean
  completedMeetingsCount: number
  completedOnboardingTasksCount: number
  openOnboardingTasksCount: number
  overdueOnboardingTasksCount: number
  missedFollowupsCount: number
  renewalDate: string | null
  nowMs?: number
}

export type CustomerHealthScoreResult = {
  score: number
  indicators: string[]
}

function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  return Math.floor((nowMs - Date.parse(iso)) / (24 * 60 * 60 * 1000))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeCustomerHealthScore(input: CustomerHealthScoreInput): CustomerHealthScoreResult {
  const nowMs = input.nowMs ?? Date.now()
  let score = 50
  const indicators: string[] = []

  if (input.activationAt) {
    score += 10
    indicators.push("activated")
  }
  if (input.firstValueAt) {
    score += 10
    indicators.push("first_value_recorded")
  }
  if (input.onboardingCompleted) {
    score += 8
    indicators.push("onboarding_completed")
  }
  if (input.completedMeetingsCount > 0) {
    score += Math.min(12, input.completedMeetingsCount * 4)
    indicators.push("meeting_completion")
  }
  if (input.completedOnboardingTasksCount >= 3) {
    score += 6
    indicators.push("onboarding_progress")
  }

  const engagementDays = daysSince(input.lastEngagementAt, nowMs)
  if (engagementDays !== null && engagementDays <= 14) {
    score += 10
    indicators.push("recent_engagement")
  } else if (engagementDays !== null && engagementDays <= 30) {
    score += 4
  } else if (engagementDays === null || engagementDays > 45) {
    score -= 18
    indicators.push("inactivity")
  }

  if (input.overdueOnboardingTasksCount > 0) {
    score -= Math.min(20, input.overdueOnboardingTasksCount * 8)
    indicators.push("onboarding_overdue")
  }
  if (input.missedFollowupsCount > 0) {
    score -= Math.min(16, input.missedFollowupsCount * 6)
    indicators.push("missed_followups")
  }
  if (input.openOnboardingTasksCount > 2) {
    score -= 4
  }

  const renewalDays = input.renewalDate
    ? Math.floor((Date.parse(input.renewalDate) - nowMs) / (24 * 60 * 60 * 1000))
    : null
  if (renewalDays !== null && renewalDays <= 30 && (engagementDays === null || engagementDays > 21)) {
    score -= 12
    indicators.push("renewal_without_activity")
  }

  return { score: clampScore(score), indicators }
}

export type CustomerExpansionScoreInput = {
  healthScore: number
  lifecycleStage: GrowthCustomerLifecycleStage
  lifecycleAgeDays: number
  reviewReceived: boolean
  completedMeetingsCount: number
  expansionOpportunityCount: number
}

export function computeCustomerExpansionScore(input: CustomerExpansionScoreInput): number {
  let score = 0
  if (input.healthScore >= 70) score += 25
  else if (input.healthScore >= 55) score += 12

  if (["healthy", "expansion_candidate", "activated"].includes(input.lifecycleStage)) score += 20
  if (input.lifecycleAgeDays >= 90) score += 15
  if (input.reviewReceived) score += 15
  if (input.completedMeetingsCount >= 2) score += 10
  if (input.expansionOpportunityCount > 0) score += Math.min(15, input.expansionOpportunityCount * 5)

  return clampScore(score)
}

export function deriveCustomerLifecycleStage(input: {
  onboardingStatus: "pending" | "active" | "completed"
  activationAt: string | null
  healthScore: number
  expansionScore: number
  renewalDate: string | null
  renewalWindowOpen: boolean
  lastEngagementAt: string | null
  nowMs?: number
}): GrowthCustomerLifecycleStage {
  const nowMs = input.nowMs ?? Date.now()
  const inactivityDays = daysSince(input.lastEngagementAt, nowMs)

  if (inactivityDays !== null && inactivityDays > 90) return "inactive"
  if (input.healthScore < 35) return "churn_risk"

  if (input.renewalDate) {
    const renewalDays = Math.floor((Date.parse(input.renewalDate) - nowMs) / (24 * 60 * 60 * 1000))
    if (renewalDays <= 0) return "renewal_due"
    if (input.renewalWindowOpen && renewalDays <= 30 && input.healthScore < 55) return "churn_risk"
    if (input.renewalWindowOpen && renewalDays <= 60) return "renewal_due"
  }

  if (input.expansionScore >= 70) return "expansion_candidate"
  if (input.onboardingStatus === "pending") return "onboarding_pending"
  if (input.onboardingStatus === "active") return "onboarding_active"
  if (input.activationAt) {
    if (input.healthScore >= 65) return "healthy"
    return "activated"
  }
  return "onboarding_active"
}

export function isRenewalWindowOpen(renewalDate: string | null, windowDays: number, nowMs = Date.now()): boolean {
  if (!renewalDate) return false
  const daysUntil = Math.floor((Date.parse(renewalDate) - nowMs) / (24 * 60 * 60 * 1000))
  return daysUntil <= windowDays && daysUntil >= -7
}

export function isReviewEligible(input: {
  onboardingCompleted: boolean
  healthScore: number
  reviewStatus: string
  minHealthScore: number
}): boolean {
  if (!input.onboardingCompleted) return false
  if (input.reviewStatus === "review_requested" || input.reviewStatus === "review_received") return false
  return input.healthScore >= input.minHealthScore
}

export function isReferralEligible(input: {
  lifecycleStage: GrowthCustomerLifecycleStage
  lifecycleAgeDays: number
  healthScore: number
  reviewReceived: boolean
  referralStatus: string
  minLifecycleDays: number
  minHealthScore: number
}): boolean {
  if (input.referralStatus === "referral_requested" || input.referralStatus === "referral_received") {
    return false
  }
  if (input.healthScore < input.minHealthScore) return false
  if (!["healthy", "activated", "expansion_candidate"].includes(input.lifecycleStage)) return false
  if (input.lifecycleAgeDays < input.minLifecycleDays && !input.reviewReceived) return false
  if (input.reviewReceived) return true
  return input.lifecycleAgeDays >= input.minLifecycleDays
}

export function healthScoreBand(score: number): string {
  if (score >= 80) return "excellent"
  if (score >= 65) return "good"
  if (score >= 45) return "fair"
  return "at_risk"
}
