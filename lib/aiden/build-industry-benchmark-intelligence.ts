import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BENCHMARK_METRIC_META,
  collectOrgOperationalBenchmarkSignals,
} from "@/lib/aiden/industry-operational-benchmark-signals"
import {
  buildComparisonForMetric,
  dedupeLatestSnapshots,
  INDUSTRY_BENCHMARK_MIN_ORGS,
} from "@/lib/aiden/industry-operational-benchmark-core"
import { fetchLatestBenchmarkSnapshots } from "@/lib/aiden/industry-operational-benchmark-store"
import type { IndustryBenchmarkIntelligence } from "@/lib/aiden/industry-operational-benchmark-types"
import { INDUSTRY_BENCHMARK_METRIC_KEYS } from "@/lib/aiden/industry-operational-benchmark-types"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

export async function buildIndustryBenchmarkIntelligence(args: {
  supabase: SupabaseClient
  admin: SupabaseClient | null
  organizationId: string
  industryRaw: string | null | undefined
  reportingWindowDays: number
}): Promise<IndustryBenchmarkIntelligence> {
  const generatedAt = new Date().toISOString()
  const hasExplicitIndustry = Boolean(args.industryRaw?.trim())
  const industryKey = normalizeIndustryKey(args.industryRaw ?? undefined)
  const metricsIndustry: WorkspaceIndustryKey = industryKey

  const signals = await collectOrgOperationalBenchmarkSignals(args.supabase, args.organizationId, metricsIndustry)

  if (!args.admin) {
    return {
      generatedAt,
      industryKey,
      reportingWindowDays: args.reportingWindowDays,
      sampleStatus: "insufficient_aggregate_data",
      minimumOrgsRequired: INDUSTRY_BENCHMARK_MIN_ORGS,
      comparisons: INDUSTRY_BENCHMARK_METRIC_KEYS.map((metricKey) =>
        buildComparisonForMetric({
          metricKey,
          metricTitle: BENCHMARK_METRIC_META[metricKey].title,
          lowerIsBetter: BENCHMARK_METRIC_META[metricKey].lowerIsBetter,
          yourValue: signals[metricKey],
          snapshot: null,
        }),
      ),
      privacyFootnote:
        "Peer bands are loaded from aggregate-only tables populated by a trusted batch job. No other tenant identifiers are returned.",
      methodologyFootnote:
        "Server is not configured to read aggregate benchmarks (missing service role). Comparisons cannot be loaded.",
    }
  }

  const rows =
    hasExplicitIndustry && args.admin ?
      await fetchLatestBenchmarkSnapshots(args.admin, industryKey, args.reportingWindowDays)
    : []
  const latest = dedupeLatestSnapshots(rows)

  const anyReady = [...latest.values()].some((r) => r.orgs_contributing >= INDUSTRY_BENCHMARK_MIN_ORGS)

  const sampleStatus =
    !hasExplicitIndustry ? "insufficient_industry_sample" : !anyReady ? "insufficient_aggregate_data" : "ready"

  const comparisons = INDUSTRY_BENCHMARK_METRIC_KEYS.map((metricKey) =>
    buildComparisonForMetric({
      metricKey,
      metricTitle: BENCHMARK_METRIC_META[metricKey].title,
      lowerIsBetter: BENCHMARK_METRIC_META[metricKey].lowerIsBetter,
      yourValue: signals[metricKey],
      snapshot: latest.get(metricKey) ?? null,
    }),
  )

  return {
    generatedAt,
    industryKey,
    reportingWindowDays: args.reportingWindowDays,
    sampleStatus,
    minimumOrgsRequired: INDUSTRY_BENCHMARK_MIN_ORGS,
    comparisons,
    privacyFootnote:
      "Benchmarks are industry-segmented, aggregate-only rows (p25 / p50 / p75) computed across many workspaces. "
      + "No customer names, free-text work order bodies, or per-tenant identifiers are stored in benchmark tables or returned by this API.",
    methodologyFootnote:
      "Signals are bounded counts and ratios from your org only; peer distributions are recomputed offline and only published when orgs_contributing meets the platform minimum.",
  }
}
