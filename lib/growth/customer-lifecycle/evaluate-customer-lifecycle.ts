import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeCustomerExpansionScore,
  computeCustomerHealthScore,
  deriveCustomerLifecycleStage,
  isReferralEligible,
  isRenewalWindowOpen,
  isReviewEligible,
} from "@/lib/growth/customer-lifecycle/customer-health-engine"
import {
  countOnboardingTaskStats,
  listGrowthCustomerOnboardingTasks,
} from "@/lib/growth/customer-lifecycle/customer-onboarding-task-repository"
import {
  emitChurnRiskNotification,
  emitExpansionCandidateNotification,
  emitFollowupMissingNotification,
  emitOnboardingOverdueNotification,
  emitReferralEligibleNotification,
  emitRenewalDueNotification,
  emitRenewalRiskNotification,
  emitReviewRequestDueNotification,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-notifications"
import {
  emitChurnRiskDetectedTimeline,
  emitExpansionCandidateDetectedTimeline,
  emitRenewalDueTimeline,
  emitRenewalWindowOpenedTimeline,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-timeline-emitter"
import {
  fetchGrowthCustomerLifecycleSettings,
  listGrowthCustomerProfilesForScan,
  updateGrowthCustomerProfileRow,
  type GrowthCustomerProfile,
} from "@/lib/growth/customer-lifecycle/customer-profile-repository"

async function countCompletedMeetings(admin: SupabaseClient, leadId: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "completed")
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function recomputeGrowthCustomerProfile(
  admin: SupabaseClient,
  profile: GrowthCustomerProfile,
): Promise<GrowthCustomerProfile> {
  const settings = await fetchGrowthCustomerLifecycleSettings(admin)
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const taskStats = await countOnboardingTaskStats(admin, profile.id, nowIso)
  const completedMeetingsCount = await countCompletedMeetings(admin, profile.leadId)
  const onboardingCompleted = profile.onboardingStatus === "completed"

  const health = computeCustomerHealthScore({
    lastEngagementAt: profile.lastEngagementAt,
    activationAt: profile.activationAt,
    firstValueAt: profile.firstValueAt,
    onboardingCompleted,
    completedMeetingsCount,
    completedOnboardingTasksCount: taskStats.completedCount,
    openOnboardingTasksCount: taskStats.openCount,
    overdueOnboardingTasksCount: taskStats.overdueCount,
    missedFollowupsCount: profile.churnIndicators.includes("missed_followups") ? 1 : 0,
    renewalDate: profile.renewalDate,
    nowMs,
  })

  const lifecycleAgeDays = Math.floor((nowMs - Date.parse(profile.closedWonAt)) / (24 * 60 * 60 * 1000))
  const expansionScore = computeCustomerExpansionScore({
    healthScore: health.score,
    lifecycleStage: profile.lifecycleStage,
    lifecycleAgeDays,
    reviewReceived: profile.reviewStatus === "review_received",
    completedMeetingsCount,
    expansionOpportunityCount: profile.expansionOpportunityCount,
  })

  const renewalWindowOpen = isRenewalWindowOpen(profile.renewalDate, settings.renewalWindowDays, nowMs)
  const lifecycleStage = deriveCustomerLifecycleStage({
    onboardingStatus: profile.onboardingStatus,
    activationAt: profile.activationAt,
    healthScore: health.score,
    expansionScore,
    renewalDate: profile.renewalDate,
    renewalWindowOpen,
    lastEngagementAt: profile.lastEngagementAt,
    nowMs,
  })

  let reviewStatus = profile.reviewStatus
  if (reviewStatus === "none" && isReviewEligible({ onboardingCompleted, healthScore: health.score, reviewStatus, minHealthScore: settings.reviewMinHealthScore })) {
    reviewStatus = "review_pending"
  }

  let referralStatus = profile.referralStatus
  if (
    referralStatus === "none" &&
    isReferralEligible({
      lifecycleStage,
      lifecycleAgeDays,
      healthScore: health.score,
      reviewReceived: profile.reviewStatus === "review_received",
      referralStatus,
      minLifecycleDays: settings.referralMinLifecycleDays,
      minHealthScore: settings.referralMinHealthScore,
    })
  ) {
    referralStatus = "referral_eligible"
  }

  return updateGrowthCustomerProfileRow(admin, profile.id, {
    health_score: health.score,
    expansion_score: expansionScore,
    lifecycle_stage: lifecycleStage,
    renewal_window_open: renewalWindowOpen,
    churn_indicators: health.indicators,
    review_status: reviewStatus,
    referral_status: referralStatus,
  })
}

export async function evaluateGrowthCustomerLifecycleNotifications(admin: SupabaseClient): Promise<void> {
  const profiles = await listGrowthCustomerProfilesForScan(admin)
  const nowIso = new Date().toISOString()

  for (const profile of profiles) {
    const recomputed = await recomputeGrowthCustomerProfile(admin, profile)
    const taskStats = await countOnboardingTaskStats(admin, profile.id, nowIso)

    if (taskStats.overdueCount > 0) {
      await emitOnboardingOverdueNotification(admin, { profile: recomputed, overdueCount: taskStats.overdueCount })
    }
    if (recomputed.reviewStatus === "review_pending") {
      await emitReviewRequestDueNotification(admin, { profile: recomputed })
    }
    if (recomputed.referralStatus === "referral_eligible") {
      await emitReferralEligibleNotification(admin, { profile: recomputed })
    }
    if (recomputed.lifecycleStage === "renewal_due") {
      await emitRenewalDueNotification(admin, { profile: recomputed })
      await emitRenewalDueTimeline(admin, { profile: recomputed })
    }
    if (recomputed.lifecycleStage === "churn_risk" && recomputed.renewalWindowOpen) {
      await emitRenewalRiskNotification(admin, { profile: recomputed })
    }
    if (recomputed.lifecycleStage === "expansion_candidate") {
      await emitExpansionCandidateNotification(admin, { profile: recomputed })
      await emitExpansionCandidateDetectedTimeline(admin, { profile: recomputed })
    }
    if (recomputed.lifecycleStage === "churn_risk" || recomputed.lifecycleStage === "inactive") {
      await emitChurnRiskNotification(admin, { profile: recomputed })
      await emitChurnRiskDetectedTimeline(admin, { profile: recomputed })
    }
    if (
      recomputed.renewalWindowOpen &&
      !profile.renewalWindowOpen &&
      recomputed.lifecycleStage !== "churn_risk"
    ) {
      await emitRenewalWindowOpenedTimeline(admin, { profile: recomputed })
    }
    if (
      !recomputed.lastEngagementAt ||
      Date.parse(recomputed.lastEngagementAt) < Date.now() - 45 * 24 * 60 * 60 * 1000
    ) {
      await emitFollowupMissingNotification(admin, { profile: recomputed })
    }
  }
}
