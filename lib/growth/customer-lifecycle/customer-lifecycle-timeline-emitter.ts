import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

export async function emitCustomerCreatedTimeline(
  admin: SupabaseClient,
  input: { profile: GrowthCustomerProfile; actorUserId?: string | null; actorEmail?: string | null },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "customer_created",
    title: "Customer lifecycle profile created",
    summary: `${input.profile.companyName} moved into post-close lifecycle.`,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    payload: { customerProfileId: input.profile.id, opportunityId: input.profile.opportunityId },
  })
}

export async function emitOnboardingStartedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "onboarding_started",
    title: "Onboarding started",
    summary: "Onboarding tasks assigned to owner.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitOnboardingCompletedTimeline(
  admin: SupabaseClient,
  input: { profile: GrowthCustomerProfile },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "onboarding_completed",
    title: "Onboarding completed",
    summary: "All onboarding tasks completed by owner.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitActivationRecordedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "activation_recorded",
    title: "Activation recorded",
    summary: "Customer activation date recorded manually.",
    payload: { customerProfileId: input.profile.id, activationAt: input.profile.activationAt },
  })
}

export async function emitReviewRequestedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "review_requested",
    title: "Review request initiated",
    summary: "Owner requested a customer review — no automatic posting.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitReviewReceivedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "review_received",
    title: "Review received",
    summary: "Customer review recorded manually.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitReferralRequestedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "referral_requested",
    title: "Referral request initiated",
    summary: "Owner requested a referral — human sends externally.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitReferralReceivedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "referral_received",
    title: "Referral received",
    summary: "Referral outcome recorded manually.",
    payload: { customerProfileId: input.profile.id },
  })
}

export async function emitRenewalWindowOpenedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "renewal_window_opened",
    title: "Renewal window opened",
    summary: `Renewal date ${input.profile.renewalDate ?? "pending"} entered active window.`,
    payload: { customerProfileId: input.profile.id, renewalDate: input.profile.renewalDate },
  })
}

export async function emitRenewalDueTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "renewal_due",
    title: "Renewal due",
    summary: "Renewal follow-up required — owner action only.",
    payload: { customerProfileId: input.profile.id, renewalDate: input.profile.renewalDate },
  })
}

export async function emitExpansionCandidateDetectedTimeline(
  admin: SupabaseClient,
  input: { profile: GrowthCustomerProfile },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "expansion_candidate_detected",
    title: "Expansion candidate detected",
    summary: "Deterministic expansion signals met — no automatic opportunity created.",
    payload: { customerProfileId: input.profile.id, expansionScore: input.profile.expansionScore },
  })
}

export async function emitChurnRiskDetectedTimeline(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.profile.leadId,
    eventType: "churn_risk_detected",
    title: "Churn risk detected",
    summary: `Indicators: ${input.profile.churnIndicators.join(", ") || "health decline"}`,
    payload: { customerProfileId: input.profile.id, healthScore: input.profile.healthScore },
  })
}
