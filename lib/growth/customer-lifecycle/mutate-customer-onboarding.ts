import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  fetchGrowthCustomerLifecycleSettings,
  fetchGrowthCustomerProfileById,
  updateGrowthCustomerProfileRow,
} from "@/lib/growth/customer-lifecycle/customer-profile-repository"
import type { GrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import { recomputeGrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/evaluate-customer-lifecycle"
import {
  emitActivationRecordedTimeline,
  emitOnboardingCompletedTimeline,
  emitReferralReceivedTimeline,
  emitReferralRequestedTimeline,
  emitReviewReceivedTimeline,
  emitReviewRequestedTimeline,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-timeline-emitter"
import { emitReviewReceivedNotification } from "@/lib/growth/customer-lifecycle/customer-lifecycle-notifications"
import {
  fetchGrowthCustomerOnboardingTaskById,
  listGrowthCustomerOnboardingTasks,
  updateGrowthCustomerOnboardingTaskRow,
} from "@/lib/growth/customer-lifecycle/customer-onboarding-task-repository"
import { isReferralEligible, isReviewEligible } from "@/lib/growth/customer-lifecycle/customer-health-engine"

type Actor = { userId?: string | null; email?: string | null }

export type MutateGrowthCustomerResult =
  | { ok: true; profile: GrowthCustomerProfile }
  | { ok: false; code: string; message: string }

async function maybeCompleteOnboarding(
  admin: SupabaseClient,
  profile: GrowthCustomerProfile,
): Promise<GrowthCustomerProfile> {
  const openTasks = await listGrowthCustomerOnboardingTasks(admin, { customerProfileId: profile.id, status: "open" })
  if (openTasks.length > 0 || profile.onboardingStatus === "completed") return profile

  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, { onboarding_status: "completed" })
  await emitOnboardingCompletedTimeline(admin, { profile: updated })
  return updated
}

export async function completeGrowthCustomerOnboardingTask(
  admin: SupabaseClient,
  input: { taskId: string; outcome?: string | null; actor?: Actor },
): Promise<{ ok: true; task: Awaited<ReturnType<typeof fetchGrowthCustomerOnboardingTaskById>>; profile: GrowthCustomerProfile } | { ok: false; code: string; message: string }> {
  const task = await fetchGrowthCustomerOnboardingTaskById(admin, input.taskId)
  if (!task) return { ok: false, code: "not_found", message: "Task not found." }
  if (task.status !== "open") return { ok: false, code: "not_open", message: "Task is not open." }

  const updatedTask = await updateGrowthCustomerOnboardingTaskRow(admin, task.id, {
    status: "completed",
    outcome: input.outcome ?? "completed",
    completed_at: new Date().toISOString(),
    completed_by: input.actor?.userId ?? null,
  })

  let profile = await fetchGrowthCustomerProfileById(admin, task.customerProfileId)
  if (!profile) return { ok: false, code: "profile_not_found", message: "Customer profile not found." }

  if (task.taskKey === "first_success_milestone" && !profile.firstValueAt) {
    profile = await updateGrowthCustomerProfileRow(admin, profile.id, {
      first_value_at: new Date().toISOString(),
      last_engagement_at: new Date().toISOString(),
    })
  }

  profile = await maybeCompleteOnboarding(admin, profile)
  profile = await recomputeGrowthCustomerProfile(admin, profile)
  logGrowthEngine("customer_onboarding_task_completed", { taskId: task.id, profileId: profile.id })
  return { ok: true, task: updatedTask, profile }
}

export async function skipGrowthCustomerOnboardingTask(
  admin: SupabaseClient,
  input: { taskId: string; reason?: string | null; actor?: Actor },
): Promise<{ ok: true; profile: GrowthCustomerProfile } | { ok: false; code: string; message: string }> {
  const task = await fetchGrowthCustomerOnboardingTaskById(admin, input.taskId)
  if (!task) return { ok: false, code: "not_found", message: "Task not found." }
  if (task.status !== "open") return { ok: false, code: "not_open", message: "Task is not open." }

  await updateGrowthCustomerOnboardingTaskRow(admin, task.id, {
    status: "skipped",
    skipped_reason: input.reason ?? "Skipped by operator",
    completed_at: new Date().toISOString(),
    completed_by: input.actor?.userId ?? null,
  })

  let profile = await fetchGrowthCustomerProfileById(admin, task.customerProfileId)
  if (!profile) return { ok: false, code: "profile_not_found", message: "Customer profile not found." }
  profile = await maybeCompleteOnboarding(admin, profile)
  profile = await recomputeGrowthCustomerProfile(admin, profile)
  return { ok: true, profile }
}

export async function recordGrowthCustomerActivation(
  admin: SupabaseClient,
  input: { profileId: string; activationAt?: string | null; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const activationAt = input.activationAt ?? new Date().toISOString()
  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    activation_at: activationAt,
    last_engagement_at: activationAt,
  })
  await emitActivationRecordedTimeline(admin, { profile: updated })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function requestGrowthCustomerReview(
  admin: SupabaseClient,
  input: { profileId: string; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const settings = await fetchGrowthCustomerLifecycleSettings(admin)
  if (
    !isReviewEligible({
      onboardingCompleted: profile.onboardingStatus === "completed",
      healthScore: profile.healthScore,
      reviewStatus: profile.reviewStatus,
      minHealthScore: settings.reviewMinHealthScore,
    })
  ) {
    return { ok: false, code: "not_eligible", message: "Customer is not eligible for review request yet." }
  }

  const now = new Date().toISOString()
  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    review_status: "review_requested",
    review_requested_at: now,
    last_engagement_at: now,
  })
  await emitReviewRequestedTimeline(admin, { profile: updated })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function recordGrowthCustomerReviewReceived(
  admin: SupabaseClient,
  input: { profileId: string; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const now = new Date().toISOString()
  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    review_status: "review_received",
    review_received_at: now,
    last_engagement_at: now,
  })
  await emitReviewReceivedTimeline(admin, { profile: updated })
  await emitReviewReceivedNotification(admin, { profile: updated })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function requestGrowthCustomerReferral(
  admin: SupabaseClient,
  input: { profileId: string; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const settings = await fetchGrowthCustomerLifecycleSettings(admin)
  const lifecycleAgeDays = Math.floor((Date.now() - Date.parse(profile.closedWonAt)) / (24 * 60 * 60 * 1000))
  if (
    !isReferralEligible({
      lifecycleStage: profile.lifecycleStage,
      lifecycleAgeDays,
      healthScore: profile.healthScore,
      reviewReceived: profile.reviewStatus === "review_received",
      referralStatus: profile.referralStatus,
      minLifecycleDays: settings.referralMinLifecycleDays,
      minHealthScore: settings.referralMinHealthScore,
    })
  ) {
    return { ok: false, code: "not_eligible", message: "Customer is not eligible for referral request yet." }
  }

  const now = new Date().toISOString()
  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    referral_status: "referral_requested",
    referral_requested_at: now,
    last_engagement_at: now,
  })
  await emitReferralRequestedTimeline(admin, { profile: updated })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function recordGrowthCustomerReferralReceived(
  admin: SupabaseClient,
  input: { profileId: string; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const now = new Date().toISOString()
  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    referral_status: "referral_received",
    referral_received_at: now,
    last_engagement_at: now,
  })
  await emitReferralReceivedTimeline(admin, { profile: updated })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function updateGrowthCustomerRenewalDate(
  admin: SupabaseClient,
  input: { profileId: string; renewalDate: string | null; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    renewal_date: input.renewalDate,
    last_engagement_at: new Date().toISOString(),
  })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}

export async function recordGrowthCustomerEngagement(
  admin: SupabaseClient,
  input: { profileId: string; actor?: Actor },
): Promise<MutateGrowthCustomerResult> {
  const profile = await fetchGrowthCustomerProfileById(admin, input.profileId)
  if (!profile) return { ok: false, code: "not_found", message: "Customer profile not found." }

  const updated = await updateGrowthCustomerProfileRow(admin, profile.id, {
    last_engagement_at: new Date().toISOString(),
  })
  const enriched = await recomputeGrowthCustomerProfile(admin, updated)
  return { ok: true, profile: enriched }
}
