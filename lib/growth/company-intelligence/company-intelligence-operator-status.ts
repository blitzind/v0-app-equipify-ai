import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type GrowthCompanyIntelligenceOperatorStatus = {
  company_id: string
  company_name: string
  has_intelligence_snapshots: boolean
  snapshot_count: number
  latest_run_id: string | null
  latest_run_status: string | null
  latest_run_at: string | null
  latest_finding_count: number
  latest_verified_count: number
  latest_promoted_count: number
  categories_present: string[]
}

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

  const { data: latestRun } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, status, created_at, finding_count, verified_count, promoted_count")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    company_id,
    company_name: asString(company.display_name) || "",
    has_intelligence_snapshots: (snapshots?.length ?? 0) > 0,
    snapshot_count: snapshots?.length ?? 0,
    latest_run_id: latestRun ? asString(latestRun.id) : null,
    latest_run_status: latestRun ? asString(latestRun.status) : null,
    latest_run_at: latestRun ? asString(latestRun.created_at) : null,
    latest_finding_count: Number(latestRun?.finding_count) || 0,
    latest_verified_count: Number(latestRun?.verified_count) || 0,
    latest_promoted_count: Number(latestRun?.promoted_count) || 0,
    categories_present: categories,
  }
}
