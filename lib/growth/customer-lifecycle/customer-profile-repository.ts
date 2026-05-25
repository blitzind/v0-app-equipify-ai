import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCustomerLifecycleInboxView,
  GrowthCustomerLifecycleStage,
  GrowthCustomerOnboardingStatus,
  GrowthCustomerProfile,
  GrowthCustomerReferralStatus,
  GrowthCustomerReviewStatus,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

const PROFILE_SELECT =
  "id, lead_id, opportunity_id, organization_id, owner_user_id, company_name, lifecycle_stage, onboarding_status, closed_won_at, activation_at, first_value_at, health_score, expansion_score, renewal_date, renewal_window_open, last_engagement_at, review_status, referral_status, review_requested_at, review_received_at, referral_requested_at, referral_received_at, expansion_opportunity_count, churn_indicators, created_at, updated_at"

type ProfileDbRow = {
  id: string
  lead_id: string
  opportunity_id: string
  organization_id: string | null
  owner_user_id: string | null
  company_name: string
  lifecycle_stage: string
  onboarding_status: string
  closed_won_at: string
  activation_at: string | null
  first_value_at: string | null
  health_score: number
  expansion_score: number
  renewal_date: string | null
  renewal_window_open: boolean
  last_engagement_at: string | null
  review_status: string
  referral_status: string
  review_requested_at: string | null
  review_received_at: string | null
  referral_requested_at: string | null
  referral_received_at: string | null
  expansion_opportunity_count: number
  churn_indicators: unknown
  created_at: string
  updated_at: string
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("customer_profiles")
}

export function mapGrowthCustomerProfileRow(row: ProfileDbRow): GrowthCustomerProfile {
  return {
    id: row.id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    companyName: row.company_name,
    lifecycleStage: row.lifecycle_stage as GrowthCustomerLifecycleStage,
    onboardingStatus: row.onboarding_status as GrowthCustomerOnboardingStatus,
    closedWonAt: row.closed_won_at,
    activationAt: row.activation_at,
    firstValueAt: row.first_value_at,
    healthScore: row.health_score,
    expansionScore: row.expansion_score,
    renewalDate: row.renewal_date,
    renewalWindowOpen: row.renewal_window_open,
    lastEngagementAt: row.last_engagement_at,
    reviewStatus: row.review_status as GrowthCustomerReviewStatus,
    referralStatus: row.referral_status as GrowthCustomerReferralStatus,
    reviewRequestedAt: row.review_requested_at,
    reviewReceivedAt: row.review_received_at,
    referralRequestedAt: row.referral_requested_at,
    referralReceivedAt: row.referral_received_at,
    expansionOpportunityCount: row.expansion_opportunity_count,
    churnIndicators: Array.isArray(row.churn_indicators) ? (row.churn_indicators as string[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthCustomerProfileById(
  admin: SupabaseClient,
  profileId: string,
): Promise<GrowthCustomerProfile | null> {
  const { data, error } = await profilesTable(admin).select(PROFILE_SELECT).eq("id", profileId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCustomerProfileRow(data as ProfileDbRow) : null
}

export async function fetchGrowthCustomerProfileByLeadId(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthCustomerProfile | null> {
  const { data, error } = await profilesTable(admin).select(PROFILE_SELECT).eq("lead_id", leadId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCustomerProfileRow(data as ProfileDbRow) : null
}

export async function fetchGrowthCustomerProfileByOpportunityId(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<GrowthCustomerProfile | null> {
  const { data, error } = await profilesTable(admin)
    .select(PROFILE_SELECT)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCustomerProfileRow(data as ProfileDbRow) : null
}

export async function insertGrowthCustomerProfileRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthCustomerProfile> {
  const { data, error } = await profilesTable(admin).insert(row).select(PROFILE_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthCustomerProfileRow(data as ProfileDbRow)
}

export async function updateGrowthCustomerProfileRow(
  admin: SupabaseClient,
  profileId: string,
  patch: Record<string, unknown>,
): Promise<GrowthCustomerProfile> {
  const { data, error } = await profilesTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthCustomerProfileRow(data as ProfileDbRow)
}

export async function listGrowthCustomerProfiles(
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
  const now = new Date().toISOString()
  let query = profilesTable(admin).select(PROFILE_SELECT)
  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.lifecycleStage) query = query.eq("lifecycle_stage", input.lifecycleStage)
  if (input.reviewStatus) query = query.eq("review_status", input.reviewStatus)
  if (input.referralStatus) query = query.eq("referral_status", input.referralStatus)
  if (input.minHealthScore != null) query = query.gte("health_score", input.minHealthScore)
  if (input.maxHealthScore != null) query = query.lte("health_score", input.maxHealthScore)
  if (input.renewalDueBefore) query = query.lte("renewal_date", input.renewalDueBefore)

  switch (input.view ?? "all") {
    case "onboarding":
      query = query.in("lifecycle_stage", ["onboarding_pending", "onboarding_active"])
      break
    case "healthy":
      query = query.in("lifecycle_stage", ["healthy", "activated"])
      break
    case "renewals":
      query = query.in("lifecycle_stage", ["renewal_due", "churn_risk"]).not("renewal_date", "is", null)
      break
    case "expansion":
      query = query.eq("lifecycle_stage", "expansion_candidate")
      break
    case "churn_risk":
      query = query.in("lifecycle_stage", ["churn_risk", "inactive"])
      break
    case "reviews":
      query = query.in("review_status", ["review_pending", "review_requested"])
      break
    case "referrals":
      query = query.in("referral_status", ["referral_eligible", "referral_requested"])
      break
    case "all":
      break
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthCustomerProfileRow(row as ProfileDbRow))
}

export async function listGrowthCustomerProfilesForScan(admin: SupabaseClient): Promise<GrowthCustomerProfile[]> {
  const { data, error } = await profilesTable(admin)
    .select(PROFILE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthCustomerProfileRow(row as ProfileDbRow))
}

export async function fetchGrowthCustomerLifecycleSettings(admin: SupabaseClient) {
  const { data, error } = await admin
    .schema("growth")
    .from("customer_lifecycle_settings")
    .select(
      "onboarding_sla_days, renewal_window_days, renewal_risk_days, inactivity_days, referral_min_lifecycle_days, referral_min_health_score, review_min_health_score",
    )
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    onboardingSlaDays: data?.onboarding_sla_days ?? 14,
    renewalWindowDays: data?.renewal_window_days ?? 90,
    renewalRiskDays: data?.renewal_risk_days ?? 30,
    inactivityDays: data?.inactivity_days ?? 45,
    referralMinLifecycleDays: data?.referral_min_lifecycle_days ?? 90,
    referralMinHealthScore: data?.referral_min_health_score ?? 70,
    reviewMinHealthScore: data?.review_min_health_score ?? 60,
  }
}

export async function attachCustomerProfileTaskCounts(
  admin: SupabaseClient,
  profiles: GrowthCustomerProfile[],
): Promise<GrowthCustomerProfile[]> {
  const ids = profiles.map((p) => p.id)
  if (ids.length === 0) return profiles

  const { data, error } = await admin
    .schema("growth")
    .from("customer_onboarding_tasks")
    .select("customer_profile_id, status")
    .in("customer_profile_id", ids)
    .eq("status", "open")
  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.customer_profile_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return profiles.map((profile) => ({
    ...profile,
    openOnboardingTaskCount: counts.get(profile.id) ?? 0,
  }))
}
