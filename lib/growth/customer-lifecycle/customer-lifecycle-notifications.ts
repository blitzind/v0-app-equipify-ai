import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import type { GrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

function customerActionUrl(profile: GrowthCustomerProfile): string {
  return `/admin/growth/customer-lifecycle?open=${profile.leadId}`
}

export async function emitOnboardingOverdueNotification(
  admin: SupabaseClient,
  input: { profile: GrowthCustomerProfile; overdueCount: number },
) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "onboarding_overdue",
    title: "Onboarding overdue",
    body: `${input.profile.companyName} has ${input.overdueCount} overdue onboarding task(s).`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id, overdueCount: input.overdueCount },
  })
}

export async function emitReviewRequestDueNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "review_request_due",
    title: "Review request due",
    body: `${input.profile.companyName} is eligible for a review request — human-triggered only.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id },
  })
}

export async function emitReviewReceivedNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "review_received",
    title: "Review received",
    body: `${input.profile.companyName} review recorded.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id },
  })
}

export async function emitReferralEligibleNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "referral_eligible",
    title: "Referral eligible",
    body: `${input.profile.companyName} meets referral eligibility — owner approval required.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id },
  })
}

export async function emitRenewalDueNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "renewal_due",
    title: "Renewal due",
    body: `${input.profile.companyName} renewal due ${input.profile.renewalDate ?? "soon"}.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id, renewalDate: input.profile.renewalDate },
  })
}

export async function emitRenewalRiskNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "renewal_risk",
    title: "Renewal at risk",
    body: `${input.profile.companyName} renewal window open with declining health.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id },
  })
}

export async function emitExpansionCandidateNotification(
  admin: SupabaseClient,
  input: { profile: GrowthCustomerProfile },
) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "expansion_candidate",
    title: "Expansion candidate",
    body: `${input.profile.companyName} shows expansion readiness — no auto opportunity creation.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id, expansionScore: input.profile.expansionScore },
  })
}

export async function emitChurnRiskNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "churn_risk",
    title: "Churn risk",
    body: `${input.profile.companyName} health declined — owner follow-up recommended.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id, healthScore: input.profile.healthScore },
  })
}

export async function emitFollowupMissingNotification(admin: SupabaseClient, input: { profile: GrowthCustomerProfile }) {
  await emitGrowthNotification(admin, {
    ownerUserId: input.profile.ownerUserId,
    leadId: input.profile.leadId,
    opportunityId: input.profile.opportunityId,
    notificationType: "followup_missing",
    title: "Customer follow-up missing",
    body: `${input.profile.companyName} has no recent engagement — schedule owner follow-up.`,
    sourceSystem: "post_close",
    sourceId: input.profile.id,
    actionUrl: customerActionUrl(input.profile),
    metadata: { customerProfileId: input.profile.id },
  })
}
