import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCompanyIntelligenceDisplayStatus } from "@/lib/growth/company-intelligence/company-intelligence-discovery-status"
import { companyHasVerifiedIntelligenceSnapshots } from "@/lib/growth/company-intelligence/company-intelligence-snapshot-integrity"
import { recoverStaleCompanyIntelligenceRunningJobs } from "@/lib/growth/company-intelligence/company-intelligence-stale-jobs"
import type {
  GrowthCompanyIntelligenceJobStatus,
  GrowthCompanyIntelligenceOperatorStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type { GrowthCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export async function loadCompanyIntelligenceOperatorStatus(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<GrowthCompanyIntelligenceOperatorStatus | null> {
  const company_id = asString(input.company_id)
  if (!company_id) return null

  const { data: company, error: cErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name, status")
    .eq("id", company_id)
    .maybeSingle()
  if (cErr || !company || company.status !== "active") return null

  await recoverStaleCompanyIntelligenceRunningJobs(admin, { company_id })

  const has_verified_intelligence = await companyHasVerifiedIntelligenceSnapshots(admin, company_id)

  const { data: snapshots } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .select("intelligence_category")
    .eq("company_id", company_id)
    .neq("verification_status", "superseded")
    .limit(200)

  const categories = [
    ...new Set(
      (snapshots ?? [])
        .map((s) => asString(s.intelligence_category))
        .filter(Boolean),
    ),
  ]

  const { data: activeJob } = await admin
    .schema("growth")
    .from("company_intelligence_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .in("status", ["pending", "running"])
    .maybeSingle()

  const { data: latestJob } = await admin
    .schema("growth")
    .from("company_intelligence_jobs")
    .select("id, status, run_id, completed_at, created_at, last_error")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latest_job_status = latestJob?.status
    ? (asString(latestJob.status) as GrowthCompanyIntelligenceJobStatus)
    : null

  const { data: lastRun } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, status, completed_at, started_at, created_at, finding_count, verified_count, promoted_count")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const evidence_run_id = asString(latestJob?.run_id) || (lastRun?.id ? asString(lastRun.id) : null)

  let evidence_count = 0
  if (evidence_run_id) {
    const { count } = await admin
      .schema("growth")
      .from("company_intelligence_evidence")
      .select("id", { count: "exact", head: true })
      .eq("run_id", evidence_run_id)
    evidence_count = count ?? 0
  }

  const active_job_status = activeJob?.status
    ? (asString(activeJob.status) as GrowthCompanyIntelligenceJobStatus)
    : null
  const last_run_status = lastRun?.status ? asString(lastRun.status) : null
  const last_run_at =
    asString(lastRun?.completed_at) || asString(lastRun?.started_at) || asString(lastRun?.created_at) || null

  const discovery_status = resolveCompanyIntelligenceDisplayStatus({
    active_job_status,
    latest_job_status,
    last_run_status,
  })

  const active_job_blocked = Boolean(activeJob?.id)
  const display_run_id = evidence_run_id || null

  return {
    company_id,
    company_name: asString(company.display_name) || "",
    has_verified_intelligence,
    has_intelligence_snapshots: (snapshots?.length ?? 0) > 0,
    snapshot_count: snapshots?.length ?? 0,
    categories_present: categories,
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
    latest_finding_count: Number(lastRun?.finding_count) || 0,
    latest_verified_count: Number(lastRun?.verified_count) || 0,
    latest_promoted_count: Number(lastRun?.promoted_count) || 0,
    evidence_count,
    can_discover: !active_job_blocked && !has_verified_intelligence,
    can_view_evidence: Boolean(display_run_id && evidence_count > 0),
    active_job_blocked,
  }
}
