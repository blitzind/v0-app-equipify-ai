import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSocialProfileDiscoveryDisplayStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-discovery-status"
import { companyHasVerifiedSocialProfile } from "@/lib/growth/social-profile-discovery/social-profile-discovery-company-profile-integrity"
import { personHasVerifiedSocialProfile } from "@/lib/growth/social-profile-discovery/social-profile-discovery-person-profile-integrity"
import { recoverStaleSocialProfileDiscoveryRunningJobs } from "@/lib/growth/social-profile-discovery/social-profile-discovery-stale-jobs"
import type {
  GrowthSocialProfileDiscoveryJobStatus,
  GrowthSocialProfileDiscoveryOperatorStatus,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"
import type { GrowthSocialProfileDiscoveryScope } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadSocialProfileDiscoveryOperatorStatus(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id?: string | null
    discovery_scope?: GrowthSocialProfileDiscoveryScope
  },
): Promise<GrowthSocialProfileDiscoveryOperatorStatus | null> {
  const company_id = asString(input.company_id)
  if (!company_id) return null

  const discovery_scope: GrowthSocialProfileDiscoveryScope =
    input.discovery_scope ?? (input.person_id ? "person" : "company")
  const person_id = discovery_scope === "person" ? asString(input.person_id) : null

  if (discovery_scope === "person") {
    if (!person_id) return null
    const { data: role } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("id")
      .eq("company_id", company_id)
      .eq("person_id", person_id)
      .limit(1)
      .maybeSingle()
    if (!role) return null
  }

  await recoverStaleSocialProfileDiscoveryRunningJobs(admin, {
    company_id,
    person_id,
    discovery_scope,
  })

  const has_verified_profile =
    discovery_scope === "person" && person_id
      ? await personHasVerifiedSocialProfile(admin, person_id)
      : await companyHasVerifiedSocialProfile(admin, company_id)

  let verified_profile: string | null = null
  let verified_profile_type: GrowthSocialProfileDiscoveryOperatorStatus["verified_profile_type"] = null

  if (discovery_scope === "person" && person_id) {
    const { data: row } = await admin
      .schema("growth")
      .from("person_profiles")
      .select("profile_url, profile_type")
      .eq("person_id", person_id)
      .in("verification_status", ["verified", "operator_verified"])
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle()
    verified_profile = typeof row?.profile_url === "string" ? row.profile_url : null
    verified_profile_type =
      typeof row?.profile_type === "string"
        ? (row.profile_type as GrowthSocialProfileDiscoveryOperatorStatus["verified_profile_type"])
        : null
  } else {
    const { data: row, error } = await admin
      .schema("growth")
      .from("company_profiles")
      .select("profile_url, profile_type")
      .eq("company_id", company_id)
      .in("verification_status", ["verified", "operator_verified"])
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) {
      verified_profile = typeof row?.profile_url === "string" ? row.profile_url : null
      verified_profile_type =
        typeof row?.profile_type === "string"
          ? (row.profile_type as GrowthSocialProfileDiscoveryOperatorStatus["verified_profile_type"])
          : null
    }
  }

  let activeJobQuery = admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .eq("discovery_scope", discovery_scope)
    .in("status", ["pending", "running"])

  if (discovery_scope === "person" && person_id) {
    activeJobQuery = activeJobQuery.eq("person_id", person_id)
  } else {
    activeJobQuery = activeJobQuery.is("person_id", null)
  }
  const { data: activeJob } = await activeJobQuery.maybeSingle()

  let latestJobQuery = admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .select("id, status, run_id, completed_at, created_at, last_error")
    .eq("company_id", company_id)
    .eq("discovery_scope", discovery_scope)
    .order("created_at", { ascending: false })
    .limit(1)

  if (discovery_scope === "person" && person_id) {
    latestJobQuery = latestJobQuery.eq("person_id", person_id)
  } else {
    latestJobQuery = latestJobQuery.is("person_id", null)
  }
  const { data: latestJob } = await latestJobQuery.maybeSingle()

  const latest_job_status = latestJob?.status
    ? (asString(latestJob.status) as GrowthSocialProfileDiscoveryJobStatus)
    : null

  let lastRunQuery = admin
    .schema("growth")
    .from("social_profile_discovery_runs")
    .select("id, status, completed_at, started_at, created_at")
    .eq("company_id", company_id)
    .eq("discovery_scope", discovery_scope)
    .order("created_at", { ascending: false })
    .limit(1)

  if (discovery_scope === "person" && person_id) {
    lastRunQuery = lastRunQuery.eq("person_id", person_id)
  } else {
    lastRunQuery = lastRunQuery.is("person_id", null)
  }
  const { data: lastRun } = await lastRunQuery.maybeSingle()

  const evidence_run_id = asString(latestJob?.run_id) || (lastRun?.id ? asString(lastRun.id) : null)

  let evidence_count = 0
  if (evidence_run_id) {
    const { data: candidateRows } = await admin
      .schema("growth")
      .from("social_profile_discovery_candidates")
      .select("id")
      .eq("run_id", evidence_run_id)
    const candidateIds = (candidateRows ?? []).map((r) => asString(r.id)).filter(Boolean)
    if (candidateIds.length > 0) {
      const { count } = await admin
        .schema("growth")
        .from("social_profile_discovery_evidence")
        .select("id", { count: "exact", head: true })
        .in("candidate_id", candidateIds)
      evidence_count = count ?? 0
    }
  }

  const active_job_status = activeJob?.status
    ? (asString(activeJob.status) as GrowthSocialProfileDiscoveryJobStatus)
    : null
  const last_run_status = lastRun?.status ? asString(lastRun.status) : null
  const last_run_at =
    asString(lastRun?.completed_at) || asString(lastRun?.started_at) || asString(lastRun?.created_at) || null

  const discovery_status = resolveSocialProfileDiscoveryDisplayStatus({
    active_job_status,
    latest_job_status,
    last_run_status,
  })

  const active_job_blocked = Boolean(activeJob?.id)
  const display_run_id = evidence_run_id || null

  return {
    company_id,
    person_id,
    discovery_scope,
    has_verified_profile,
    verified_profile,
    verified_profile_type,
    discovery_status,
    job_status: active_job_status ?? latest_job_status,
    job_id: activeJob?.id
      ? asString(activeJob.id)
      : latestJob?.id
        ? asString(latestJob.id)
        : null,
    last_run_id: display_run_id,
    last_run_status,
    last_run_at:
      discovery_status === "failed" && latestJob?.completed_at
        ? asString(latestJob.completed_at) || last_run_at
        : last_run_at,
    evidence_count,
    can_discover: !active_job_blocked && !has_verified_profile,
    can_view_evidence: Boolean(display_run_id && evidence_count > 0),
    active_job_blocked,
  }
}
