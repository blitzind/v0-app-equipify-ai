/** Phase 7.PS-IM — Load benchmark + ICP-outside cohort scope. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_OUTSIDE_LIMIT,
  APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_SCAN_LIMIT,
  type DensityScaleUpCohortScope,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"
import { loadBatchIcpFilteredCohort } from "@/lib/growth/graph-expansion/batch-icp-filtered-cohort"

export async function loadApolloDensityScaleUpCohort(
  admin: SupabaseClient,
  input: {
    icp_outside_limit?: number
    icp_scan_limit?: number
  } = {},
): Promise<DensityScaleUpCohortScope> {
  const benchmark =
    (await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)) ?? null
  const benchmark_company_ids = benchmark?.company_ids ?? []
  const benchmarkSet = new Set(benchmark_company_ids)

  const icp_outside_limit = input.icp_outside_limit ?? APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_OUTSIDE_LIMIT
  const icp_scan_limit = input.icp_scan_limit ?? APOLLO_DENSITY_SCALE_UP_DEFAULT_ICP_SCAN_LIMIT

  const { cohort: icpCohort } = await loadBatchIcpFilteredCohort(admin, {
    limit: icp_outside_limit + benchmark_company_ids.length,
    scan_limit: icp_scan_limit,
    include_anchors: true,
    only_unenriched: false,
  })

  const icp_outside_company_ids = [
    ...new Set(
      icpCohort
        .map((row) => row.canonical_company_id)
        .filter((id) => id && !benchmarkSet.has(id)),
    ),
  ].slice(0, icp_outside_limit)

  const all_company_ids = [...new Set([...benchmark_company_ids, ...icp_outside_company_ids])]

  return {
    benchmark_company_ids,
    icp_outside_company_ids,
    all_company_ids,
    benchmark_company_count: benchmark_company_ids.length,
    icp_outside_company_count: icp_outside_company_ids.length,
  }
}
