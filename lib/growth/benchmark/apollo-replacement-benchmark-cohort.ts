/** Phase 7.PS-IJ — Fixed Apollo replacement benchmark cohort builder. Server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateBatchIcpFit } from "@/lib/growth/graph-expansion/batch-icp-filter"
import { scoreServiceShopFit } from "@/lib/growth/graph-expansion/service-shop-score"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import {
  loadApolloReplacementBenchmarkCohort,
  persistApolloReplacementBenchmarkCohort,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import {
  APOLLO_REPLACEMENT_BENCHMARK_COHORT_VERSION,
  APOLLO_REPLACEMENT_BENCHMARK_ID,
  APOLLO_REPLACEMENT_BENCHMARK_TARGET_SIZE,
  type ApolloReplacementBenchmarkCohortComposition,
  type ApolloReplacementBenchmarkCohortRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function bumpCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

export async function ensureApolloReplacementBenchmarkCohort(
  admin: SupabaseClient,
  input: {
    benchmark_id?: string
    cohort_version?: string
    target_size?: number
    scan_limit?: number
    force_rebuild?: boolean
  } = {},
): Promise<{
  cohort: ApolloReplacementBenchmarkCohortRecord
  created: boolean
  excluded_sample: Array<{
    company_name: string
    exclusion_reason: string | null
    icp_match_reason: string | null
  }>
}> {
  const benchmark_id = input.benchmark_id ?? APOLLO_REPLACEMENT_BENCHMARK_ID
  const cohort_version = input.cohort_version ?? APOLLO_REPLACEMENT_BENCHMARK_COHORT_VERSION
  const target_size = input.target_size ?? APOLLO_REPLACEMENT_BENCHMARK_TARGET_SIZE

  if (!input.force_rebuild) {
    const existing = await loadApolloReplacementBenchmarkCohort(admin, benchmark_id)
    if (existing && existing.company_ids.length > 0) {
      return { cohort: existing, created: false, excluded_sample: [] }
    }
  }

  const scan_limit = input.scan_limit ?? 1200
  const composition: ApolloReplacementBenchmarkCohortComposition = {
    icp_qualified: 0,
    service_shop_high: 0,
    service_shop_medium: 0,
    ps_he_anchors: 0,
    off_icp_excluded: 0,
    down_ranked_excluded: 0,
    inclusion_reasons: {},
    exclusion_reasons: {},
  }
  const excluded_sample: Array<{
    company_name: string
    exclusion_reason: string | null
    icp_match_reason: string | null
  }> = []

  const { data: promotedRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "company_id, company_name, canonical_company_id, industry, source_type, discovery_source_type, metadata, city, state",
    )
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(scan_limit)

  const canonicalIds = [
    ...new Set(
      (promotedRows ?? [])
        .map((row) => asString((row as Record<string, unknown>).canonical_company_id))
        .filter(Boolean),
    ),
  ]

  const companyMetaById = new Map<
    string,
    { website: string | null; domain: string | null; industry: string | null }
  >()
  if (canonicalIds.length > 0) {
    const { data: companies } = await admin
      .schema("growth")
      .from("companies")
      .select("id, website, primary_domain, industry")
      .in("id", canonicalIds)
    for (const row of companies ?? []) {
      const id = asString((row as Record<string, unknown>).id)
      companyMetaById.set(id, {
        website: asString((row as Record<string, unknown>).website) || null,
        domain: asString((row as Record<string, unknown>).primary_domain) || null,
        industry: asString((row as Record<string, unknown>).industry) || null,
      })
    }
  }

  type ScoredRow = {
    canonical_company_id: string
    company_name: string
    service_shop_score: number
    icp_match_reason: string | null
    is_anchor: boolean
  }

  const scored: ScoredRow[] = []
  const seen = new Set<string>()

  for (const anchor of GROWTH_PS_HE_ANCHOR_COMPANIES) {
    seen.add(anchor.canonical_company_id)
    const meta = companyMetaById.get(anchor.canonical_company_id)
    const shopScore = scoreServiceShopFit({
      company_name: anchor.company_name,
      industry: "biomedical equipment service",
      source_tags: ["ps_he_anchor"],
      website: meta?.website ?? null,
      domain: meta?.domain ?? null,
      anchor_bonus: true,
    })
    scored.push({
      canonical_company_id: anchor.canonical_company_id,
      company_name: anchor.company_name,
      service_shop_score: shopScore.score,
      icp_match_reason: "ps_he_anchor",
      is_anchor: true,
    })
    composition.ps_he_anchors += 1
    bumpCount(composition.inclusion_reasons, "ps_he_anchor")
  }

  for (const row of promotedRows ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    const company_name = asString(record.company_name)
    if (!canonical_company_id || seen.has(canonical_company_id)) continue

    const meta = companyMetaById.get(canonical_company_id)
    const industry = asString(record.industry) || meta?.industry || null
    const source_tags = [
      industry,
      asString(record.source_type),
      asString(record.discovery_source_type),
    ].filter(Boolean)

    const icpFit = evaluateBatchIcpFit({
      company_name,
      industry,
      source_tags,
      website: meta?.website ?? null,
      domain: meta?.domain ?? null,
    })

    if (icpFit.decision !== "qualified") {
      composition.off_icp_excluded += 1
      bumpCount(composition.exclusion_reasons, icpFit.exclusion_reason ?? "off_icp")
      if (excluded_sample.length < 30) {
        excluded_sample.push({
          company_name,
          exclusion_reason: icpFit.exclusion_reason,
          icp_match_reason: null,
        })
      }
      continue
    }

    const shopScore = scoreServiceShopFit({
      company_name,
      industry,
      source_tags,
      website: meta?.website ?? null,
      domain: meta?.domain ?? null,
    })

    if (shopScore.down_ranked) {
      composition.down_ranked_excluded += 1
      bumpCount(composition.exclusion_reasons, shopScore.down_rank_reason ?? "down_ranked")
      if (excluded_sample.length < 30) {
        excluded_sample.push({
          company_name,
          exclusion_reason: shopScore.down_rank_reason,
          icp_match_reason: icpFit.icp_match_reason,
        })
      }
      continue
    }

    composition.icp_qualified += 1
    bumpCount(composition.inclusion_reasons, icpFit.icp_match_reason ?? "icp_qualified")
    if (shopScore.tier === "high") composition.service_shop_high += 1
    if (shopScore.tier === "medium") composition.service_shop_medium += 1

    seen.add(canonical_company_id)
    scored.push({
      canonical_company_id,
      company_name,
      service_shop_score: shopScore.score,
      icp_match_reason: icpFit.icp_match_reason,
      is_anchor: false,
    })
  }

  scored.sort((a, b) => {
    if (a.is_anchor !== b.is_anchor) return a.is_anchor ? -1 : 1
    return b.service_shop_score - a.service_shop_score
  })

  const company_ids = scored.slice(0, target_size).map((row) => row.canonical_company_id)

  const cohort: ApolloReplacementBenchmarkCohortRecord = {
    benchmark_id,
    cohort_version,
    company_ids,
    company_count: company_ids.length,
    composition,
    created_at: new Date().toISOString(),
  }

  await persistApolloReplacementBenchmarkCohort(admin, cohort)
  return { cohort, created: true, excluded_sample }
}

export function newBenchmarkSnapshotId(): string {
  return randomUUID()
}
