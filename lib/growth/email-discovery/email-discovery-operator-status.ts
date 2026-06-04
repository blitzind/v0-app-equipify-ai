import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveEmailDiscoveryDisplayStatus } from "@/lib/growth/email-discovery/email-discovery-discovery-status"
import { recoverStaleEmailDiscoveryRunningJobs } from "@/lib/growth/email-discovery/email-discovery-stale-jobs"
import type {
  GrowthEmailDiscoveryJobStatus,
  GrowthEmailDiscoveryOperatorStatus,
} from "@/lib/growth/email-discovery/email-discovery-runtime-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadEmailDiscoveryOperatorStatus(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<GrowthEmailDiscoveryOperatorStatus | null> {
  const company_id = asString(input.company_id)
  const person_id = asString(input.person_id)
  if (!company_id || !person_id) return null

  const { data: role } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .limit(1)
    .maybeSingle()
  if (!role) return null

  await recoverStaleEmailDiscoveryRunningJobs(admin, { company_id, person_id })

  const { data: verifiedEmail } = await admin
    .schema("growth")
    .from("person_emails")
    .select("email, normalized_email")
    .eq("person_id", person_id)
    .eq("verification_status", "verified")
    .order("is_primary", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle()

  const has_verified_email = Boolean(verifiedEmail?.normalized_email)
  const verified_email =
    (typeof verifiedEmail?.email === "string" && verifiedEmail.email) ||
    (typeof verifiedEmail?.normalized_email === "string" && verifiedEmail.normalized_email) ||
    null

  const { data: activeJob } = await admin
    .schema("growth")
    .from("email_discovery_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .in("status", ["pending", "running"])
    .maybeSingle()

  const { data: latestJob } = await admin
    .schema("growth")
    .from("email_discovery_jobs")
    .select("id, status, run_id, completed_at, created_at, last_error")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latest_job_status = latestJob?.status
    ? (asString(latestJob.status) as GrowthEmailDiscoveryJobStatus)
    : null

  const { data: lastRun } = await admin
    .schema("growth")
    .from("email_discovery_runs")
    .select("id, status, completed_at, started_at, created_at, verified_count, candidate_count")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const evidence_run_id = asString(latestJob?.run_id) || (lastRun?.id ? asString(lastRun.id) : null)

  let evidence_count = 0
  if (evidence_run_id) {
    const { data: candidateRows } = await admin
      .schema("growth")
      .from("email_discovery_candidates")
      .select("id")
      .eq("run_id", evidence_run_id)
    const candidateIds = (candidateRows ?? []).map((r) => asString(r.id)).filter(Boolean)
    if (candidateIds.length > 0) {
      const { count } = await admin
        .schema("growth")
        .from("email_discovery_evidence")
        .select("id", { count: "exact", head: true })
        .in("candidate_id", candidateIds)
      evidence_count = count ?? 0
    }
  }

  const active_job_status = activeJob?.status
    ? (asString(activeJob.status) as GrowthEmailDiscoveryJobStatus)
    : null
  const last_run_status = lastRun?.status ? asString(lastRun.status) : null
  const last_run_at =
    asString(lastRun?.completed_at) || asString(lastRun?.started_at) || asString(lastRun?.created_at) || null

  const discovery_status = resolveEmailDiscoveryDisplayStatus({
    active_job_status,
    latest_job_status: latest_job_status,
    last_run_status,
  })

  const active_job_blocked = Boolean(activeJob?.id)

  const display_run_id = evidence_run_id || null

  return {
    company_id,
    person_id,
    has_verified_email,
    verified_email,
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
    verified_candidate_count: typeof lastRun?.verified_count === "number" ? lastRun.verified_count : 0,
    evidence_count,
    can_discover: !active_job_blocked && !has_verified_email,
    can_view_evidence: Boolean(display_run_id && evidence_count > 0),
    active_job_blocked,
  }
}

export async function loadEmailDiscoveryOperatorStatusBatch(
  admin: SupabaseClient,
  pairs: Array<{ company_id: string; person_id: string }>,
): Promise<Map<string, GrowthEmailDiscoveryOperatorStatus>> {
  const out = new Map<string, GrowthEmailDiscoveryOperatorStatus>()
  for (const pair of pairs.slice(0, 100)) {
    const status = await loadEmailDiscoveryOperatorStatus(admin, pair)
    if (status) out.set(`${pair.company_id}:${pair.person_id}`, status)
  }
  return out
}
