import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { IndustryBenchmarkSnapshotRow } from "@/lib/aiden/industry-operational-benchmark-core"

export async function fetchLatestBenchmarkSnapshots(
  admin: SupabaseClient,
  industryKey: string,
  reportingWindowDays: number,
): Promise<IndustryBenchmarkSnapshotRow[]> {
  const { data, error } = await admin
    .from("platform_industry_operational_benchmark_snapshots")
    .select(
      "industry_key, metric_key, reporting_window_days, orgs_contributing, p10, p25, p50, p75, p90, mean, methodology_version, computed_at",
    )
    .eq("industry_key", industryKey)
    .eq("reporting_window_days", reportingWindowDays)
    .order("computed_at", { ascending: false })
    .limit(400)

  if (error) throw new Error(error.message)
  return (data ?? []) as IndustryBenchmarkSnapshotRow[]
}

export async function insertBenchmarkSnapshotRows(
  admin: SupabaseClient,
  rows: Array<{
    industry_key: string
    metric_key: string
    reporting_window_days: number
    orgs_contributing: number
    p10: number | null
    p25: number | null
    p50: number | null
    p75: number | null
    p90: number | null
    mean: number | null
    methodology_version: string
  }>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin.from("platform_industry_operational_benchmark_snapshots").insert(rows)
  if (error) throw new Error(error.message)
}
