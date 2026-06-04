import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { buyingCommitteeHasVerifiedIntelligenceMembers } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-committee-integrity"
import { resolveBuyingCommitteeIntelligenceDisplayStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-discovery-status"
import {
  countBuyingCommitteeIntelligenceMembers,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import { recoverStaleBuyingCommitteeIntelligenceRunningJobs } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-stale-jobs"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES,
  type GrowthBuyingCommitteeIntelligenceRole,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER,
  type GrowthBuyingCommitteeIntelligenceDisplayStatus,
  type GrowthBuyingCommitteeIntelligenceJobStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type GrowthBuyingCommitteeIntelligenceOperatorStatus = {
  qa_marker: typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER
  runtime_qa_marker: typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER
  company_id: string
  company_name: string
  has_verified_committee: boolean
  can_discover: boolean
  can_view_evidence: boolean
  active_job_blocked: boolean
  member_count: number
  verified_member_count: number
  roles_present: GrowthBuyingCommitteeIntelligenceRole[]
  roles_missing: GrowthBuyingCommitteeIntelligenceRole[]
  coverage_score: number
  single_thread_risk: boolean
  discovery_status: GrowthBuyingCommitteeIntelligenceDisplayStatus
  job_status: GrowthBuyingCommitteeIntelligenceJobStatus | null
  job_id: string | null
  last_run_id: string | null
  last_run_status: string | null
  last_run_completed_at: string | null
  latest_verified_count: number
  latest_promoted_count: number
}

export async function loadBuyingCommitteeIntelligenceOperatorStatus(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<GrowthBuyingCommitteeIntelligenceOperatorStatus | null> {
  const company_id = asString(input.company_id)
  if (!company_id) return null

  const { data: company, error: cErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name, status")
    .eq("id", company_id)
    .maybeSingle()
  if (cErr || !company || company.status !== "active") return null

  await recoverStaleBuyingCommitteeIntelligenceRunningJobs(admin, { company_id })

  const has_verified_committee = await buyingCommitteeHasVerifiedIntelligenceMembers(admin, company_id)

  const counts = await countBuyingCommitteeIntelligenceMembers(admin, company_id)
  const roles_present = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.filter((r) =>
    counts.roles.includes(r),
  )
  const coverage = analyzeBuyingCommitteeCoverage({
    verified_roles: roles_present,
    verified_person_ids: counts.verified_person_ids,
  })

  const { data: activeJob } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id, status")
    .eq("company_id", company_id)
    .in("status", ["pending", "running"])
    .maybeSingle()

  const { data: latestJob } = await admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id, status, run_id, completed_at, created_at, last_error")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latest_job_status = latestJob?.status
    ? (asString(latestJob.status) as GrowthBuyingCommitteeIntelligenceJobStatus)
    : null

  const { data: lastRun } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .select("id, status, completed_at, started_at, created_at, verified_count, promoted_count")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const last_run_id = asString(latestJob?.run_id) || (lastRun?.id ? asString(lastRun.id) : null)
  const last_run_status = lastRun?.status ? asString(lastRun.status) : null
  const last_run_completed_at =
    asString(lastRun?.completed_at) || asString(lastRun?.started_at) || asString(lastRun?.created_at) || null

  const active_job_status = activeJob?.status
    ? (asString(activeJob.status) as GrowthBuyingCommitteeIntelligenceJobStatus)
    : null

  const discovery_status = resolveBuyingCommitteeIntelligenceDisplayStatus({
    active_job_status,
    latest_job_status,
    last_run_status,
  })

  const active_job_blocked = Boolean(activeJob?.id)

  let evidence_count = 0
  if (last_run_id) {
    const { count } = await admin
      .schema("growth")
      .from("buying_committee_evidence")
      .select("id", { count: "exact", head: true })
      .eq("run_id", last_run_id)
    evidence_count = count ?? 0
  }

  return {
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    runtime_qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER,
    company_id,
    company_name: asString(company.display_name) || "Company",
    has_verified_committee,
    can_discover: !active_job_blocked && !has_verified_committee,
    can_view_evidence: Boolean(last_run_id && evidence_count > 0),
    active_job_blocked,
    member_count: counts.total,
    verified_member_count: counts.verified,
    roles_present,
    roles_missing: coverage.roles_missing,
    coverage_score: coverage.coverage_score,
    single_thread_risk: coverage.single_thread_risk,
    discovery_status,
    job_status: active_job_status ?? latest_job_status,
    job_id: activeJob?.id
      ? asString(activeJob.id)
      : latestJob?.id
        ? asString(latestJob.id)
        : null,
    last_run_id,
    last_run_status,
    last_run_completed_at:
      discovery_status === "failed" && latestJob?.completed_at
        ? asString(latestJob.completed_at) || last_run_completed_at
        : last_run_completed_at,
    latest_verified_count: Number(lastRun?.verified_count) || 0,
    latest_promoted_count: Number(lastRun?.promoted_count) || 0,
  }
}
