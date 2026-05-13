/**
 * Offline aggregate job: compute anonymized industry operational benchmarks.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Run from equipify-app: pnpm aggregate:industry-benchmarks
 *
 * Writes ONLY to platform_industry_operational_benchmark_snapshots (no PII).
 * Skips industries with fewer than INDUSTRY_BENCHMARK_MIN_ORGS contributing orgs per metric.
 */
import { createServiceRoleClient } from "../lib/supabase/admin"
import { collectOrgOperationalBenchmarkSignals } from "../lib/aiden/industry-operational-benchmark-signals"
import {
  computePercentiles,
  INDUSTRY_BENCHMARK_MIN_ORGS,
} from "../lib/aiden/industry-operational-benchmark-core"
import { insertBenchmarkSnapshotRows } from "../lib/aiden/industry-operational-benchmark-store"
import { normalizeIndustryKey } from "../lib/demo-seeding/profiles"
import { INDUSTRY_BENCHMARK_METRIC_KEYS } from "../lib/aiden/industry-operational-benchmark-types"
import type { IndustryBenchmarkMetricKey } from "../lib/aiden/industry-operational-benchmark-types"
import type { OrgOperationalBenchmarkSignals } from "../lib/aiden/industry-operational-benchmark-signals"
import type { WorkspaceIndustryKey } from "../lib/workspace-industry-registry"

const REPORTING_WINDOW_DAYS = 30
const ORG_CAP = 600
const METHODOLOGY_VERSION = "equipify_ops_benchmark_v1"

async function main() {
  const admin = createServiceRoleClient()
  if (!admin) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }

  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, industry")
    .order("created_at", { ascending: false })
    .limit(ORG_CAP)

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const buckets = new Map<WorkspaceIndustryKey, Record<IndustryBenchmarkMetricKey, number[]>>()

  for (const row of orgs ?? []) {
    const id = (row as { id: string }).id
    const industryRaw = (row as { industry?: string | null }).industry ?? null
    if (!industryRaw?.trim()) continue
    const industryKey = normalizeIndustryKey(industryRaw)
    try {
      const signals = await collectOrgOperationalBenchmarkSignals(admin, id, industryKey)
      if (!buckets.has(industryKey)) {
        const empty = {} as Record<IndustryBenchmarkMetricKey, number[]>
        for (const k of INDUSTRY_BENCHMARK_METRIC_KEYS) empty[k] = []
        buckets.set(industryKey, empty)
      }
      const b = buckets.get(industryKey)!
      for (const k of INDUSTRY_BENCHMARK_METRIC_KEYS) {
        const v = signals[k as keyof OrgOperationalBenchmarkSignals]
        if (v !== null && Number.isFinite(v)) b[k].push(v)
      }
    } catch (e) {
      console.warn("skip org", id, e instanceof Error ? e.message : e)
    }
  }

  const computedAt = new Date().toISOString()
  const insertRows: Array<{
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
  }> = []

  for (const [industryKey, perMetric] of buckets.entries()) {
    for (const metricKey of INDUSTRY_BENCHMARK_METRIC_KEYS) {
      const values = perMetric[metricKey] ?? []
      if (values.length < INDUSTRY_BENCHMARK_MIN_ORGS) continue
      const { p10, p25, p50, p75, p90, mean } = computePercentiles(values)
      insertRows.push({
        industry_key: industryKey,
        metric_key: metricKey,
        reporting_window_days: REPORTING_WINDOW_DAYS,
        orgs_contributing: values.length,
        p10,
        p25,
        p50,
        p75,
        p90,
        mean,
        methodology_version: METHODOLOGY_VERSION,
      })
    }
  }

  await insertBenchmarkSnapshotRows(admin, insertRows)
  console.log(
    `Inserted ${insertRows.length} anonymized benchmark snapshot rows (window ${REPORTING_WINDOW_DAYS}d, min orgs ${INDUSTRY_BENCHMARK_MIN_ORGS}).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
