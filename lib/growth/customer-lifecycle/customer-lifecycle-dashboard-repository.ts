import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  attachCustomerProfileTaskCounts,
  listGrowthCustomerProfiles,
  listGrowthCustomerProfilesForScan,
} from "@/lib/growth/customer-lifecycle/customer-profile-repository"
import {
  GROWTH_CUSTOMER_LIFECYCLE_STAGES,
  GROWTH_POST_CLOSE_REVENUE_QA_MARKER,
  type GrowthCustomerLifecycleCommandSummary,
  type GrowthCustomerLifecycleDashboard,
  type GrowthCustomerLifecycleInboxView,
  type GrowthCustomerLifecycleStage,
  type GrowthCustomerProfile,
  type GrowthCustomerReferralStatus,
  type GrowthCustomerReviewStatus,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import { healthScoreBand } from "@/lib/growth/customer-lifecycle/customer-health-engine"
import { evaluateGrowthCustomerLifecycleNotifications } from "@/lib/growth/customer-lifecycle/evaluate-customer-lifecycle"

function aggregateProfiles(profiles: GrowthCustomerProfile[]) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const ownerMap = new Map<string | null, number>()
  for (const profile of profiles) {
    ownerMap.set(profile.ownerUserId, (ownerMap.get(profile.ownerUserId) ?? 0) + 1)
  }

  const lifecycleStageDistribution = GROWTH_CUSTOMER_LIFECYCLE_STAGES.map((stage) => ({
    stage,
    count: profiles.filter((p) => p.lifecycleStage === stage).length,
  })).filter((entry) => entry.count > 0)

  const healthBands = ["excellent", "good", "fair", "at_risk"] as const
  const healthDistribution = healthBands.map((band) => ({
    band,
    count: profiles.filter((p) => healthScoreBand(p.healthScore) === band).length,
  }))

  return {
    onboardingPipelineCount: profiles.filter((p) =>
      ["onboarding_pending", "onboarding_active"].includes(p.lifecycleStage),
    ).length,
    healthyCount: profiles.filter((p) => ["healthy", "activated"].includes(p.lifecycleStage)).length,
    renewalUpcomingCount: profiles.filter(
      (p) => p.renewalDate && p.renewalDate >= today && p.lifecycleStage === "renewal_due",
    ).length,
    renewalOverdueCount: profiles.filter((p) => p.renewalDate && p.renewalDate < today).length,
    expansionCandidateCount: profiles.filter((p) => p.lifecycleStage === "expansion_candidate").length,
    churnRiskCount: profiles.filter((p) => ["churn_risk", "inactive"].includes(p.lifecycleStage)).length,
    reviewPendingCount: profiles.filter((p) =>
      ["review_pending", "review_requested"].includes(p.reviewStatus),
    ).length,
    referralEligibleCount: profiles.filter((p) =>
      ["referral_eligible", "referral_requested"].includes(p.referralStatus),
    ).length,
    ownerWorkload: [...ownerMap.entries()].map(([ownerUserId, count]) => ({ ownerUserId, count })),
    lifecycleStageDistribution,
    healthDistribution,
  }
}

export async function fetchGrowthCustomerLifecycleDashboard(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null; refresh?: boolean },
): Promise<GrowthCustomerLifecycleDashboard> {
  if (input?.refresh) await evaluateGrowthCustomerLifecycleNotifications(admin)
  const profiles = await listGrowthCustomerProfilesForScan(admin)
  const filtered = input?.ownerUserId
    ? profiles.filter((p) => p.ownerUserId === input.ownerUserId)
    : profiles
  const stats = aggregateProfiles(filtered)

  return {
    qaMarker: GROWTH_POST_CLOSE_REVENUE_QA_MARKER,
    ...stats,
  }
}

export async function fetchGrowthCustomerLifecycleCommandSummary(
  admin: SupabaseClient,
): Promise<GrowthCustomerLifecycleCommandSummary> {
  await evaluateGrowthCustomerLifecycleNotifications(admin)
  const profiles = await listGrowthCustomerProfilesForScan(admin)
  const stats = aggregateProfiles(profiles)

  return {
    qaMarker: GROWTH_POST_CLOSE_REVENUE_QA_MARKER,
    renewalsDueCount: stats.renewalUpcomingCount + stats.renewalOverdueCount,
    expansionCandidatesCount: stats.expansionCandidateCount,
    churnRisksCount: stats.churnRiskCount,
    reviewOpportunitiesCount: stats.reviewPendingCount,
    referralOpportunitiesCount: stats.referralEligibleCount,
  }
}

export async function fetchGrowthCustomerLifecycleInbox(
  admin: SupabaseClient,
  input: {
    view?: GrowthCustomerLifecycleInboxView
    ownerUserId?: string | null
    lifecycleStage?: GrowthCustomerLifecycleStage | null
    reviewStatus?: GrowthCustomerReviewStatus | null
    referralStatus?: GrowthCustomerReferralStatus | null
    minHealthScore?: number | null
    maxHealthScore?: number | null
    renewalDueBefore?: string | null
    limit?: number
  },
): Promise<GrowthCustomerProfile[]> {
  const profiles = await listGrowthCustomerProfiles(admin, input)
  return attachCustomerProfileTaskCounts(admin, profiles)
}
