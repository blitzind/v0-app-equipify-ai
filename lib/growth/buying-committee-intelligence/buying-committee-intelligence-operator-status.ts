import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import {
  countBuyingCommitteeIntelligenceMembers,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES,
  type GrowthBuyingCommitteeIntelligenceRole,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type GrowthBuyingCommitteeIntelligenceOperatorStatus = {
  qa_marker: typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER
  company_id: string
  company_name: string
  can_discover: boolean
  member_count: number
  verified_member_count: number
  roles_present: GrowthBuyingCommitteeIntelligenceRole[]
  roles_missing: GrowthBuyingCommitteeIntelligenceRole[]
  coverage_score: number
  single_thread_risk: boolean
  last_run_id: string | null
  last_run_status: string | null
  last_run_completed_at: string | null
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

  const counts = await countBuyingCommitteeIntelligenceMembers(admin, company_id)
  const roles_present = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.filter((r) =>
    counts.roles.includes(r),
  )
  const coverage = analyzeBuyingCommitteeCoverage({
    verified_roles: roles_present,
    verified_person_ids: counts.verified_person_ids,
  })

  const { data: lastRun } = await admin
    .schema("growth")
    .from("buying_committee_runs")
    .select("id, status, completed_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    company_id,
    company_name: asString(company.display_name) || "Company",
    can_discover: true,
    member_count: counts.total,
    verified_member_count: counts.verified,
    roles_present,
    roles_missing: coverage.roles_missing,
    coverage_score: coverage.coverage_score,
    single_thread_risk: coverage.single_thread_risk,
    last_run_id: lastRun?.id ? asString(lastRun.id) : null,
    last_run_status: lastRun?.status ? asString(lastRun.status) : null,
    last_run_completed_at: lastRun?.completed_at ? asString(lastRun.completed_at) : null,
  }
}
