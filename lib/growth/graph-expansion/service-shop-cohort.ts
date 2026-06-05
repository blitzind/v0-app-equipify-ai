/** Phase 7.PS-IG — Service-shop scored cohort builder. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateBatchIcpFit } from "@/lib/growth/graph-expansion/batch-icp-filter"
import { scoreServiceShopFit } from "@/lib/growth/graph-expansion/service-shop-score"
import type {
  ServiceShopCohortDiagnosticRow,
  ServiceShopCohortDiagnostics,
} from "@/lib/growth/graph-expansion/service-shop-expansion-types"
import type { BatchGraphExpansionCohortCompany } from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function sourceTagsFromRow(row: Record<string, unknown>): string[] {
  const tags = new Set<string>()
  for (const field of ["industry", "source_type", "discovery_source_type"] as const) {
    const value = asString(row[field])
    if (value) tags.add(value)
  }
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {}
  for (const key of ["industry_label", "search_query", "provider_name", "icp_tag"]) {
    const value = asString(metadata[key])
    if (value) tags.add(value)
  }
  return [...tags]
}

export async function loadServiceShopCohort(
  admin: SupabaseClient,
  input: {
    limit?: number
    scan_limit?: number
    include_anchors?: boolean
    min_score?: number
    down_ranked_sample_limit?: number
  } = {},
): Promise<{
  cohort: BatchGraphExpansionCohortCompany[]
  diagnostics: ServiceShopCohortDiagnostics
}> {
  const limit = input.limit ?? 25
  const scan_limit = input.scan_limit ?? 500
  const min_score = input.min_score ?? 20
  const down_ranked_sample_limit = input.down_ranked_sample_limit ?? 25

  const { data: promotedRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, company_id, company_name, canonical_company_id, industry, source_type, discovery_source_type, metadata, city, state",
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
    { website: string | null; domain: string | null; industry: string | null; city: string | null; state: string | null }
  >()
  const contactCountByCompany = new Map<string, number>()

  if (canonicalIds.length > 0) {
    const [{ data: companies }, { data: contacts }] = await Promise.all([
      admin
        .schema("growth")
        .from("companies")
        .select("id, website, primary_domain, industry, city, state")
        .in("id", canonicalIds),
      admin
        .schema("growth")
        .from("company_contacts")
        .select("company_id")
        .in("company_id", canonicalIds)
        .neq("contact_status", "archived"),
    ])

    for (const row of companies ?? []) {
      const id = asString((row as Record<string, unknown>).id)
      companyMetaById.set(id, {
        website: asString((row as Record<string, unknown>).website) || null,
        domain: asString((row as Record<string, unknown>).primary_domain) || null,
        industry: asString((row as Record<string, unknown>).industry) || null,
        city: asString((row as Record<string, unknown>).city) || null,
        state: asString((row as Record<string, unknown>).state) || null,
      })
    }

    for (const row of contacts ?? []) {
      const company_id = asString((row as Record<string, unknown>).company_id)
      if (!company_id) continue
      contactCountByCompany.set(company_id, (contactCountByCompany.get(company_id) ?? 0) + 1)
    }
  }

  const scoredRows: ServiceShopCohortDiagnosticRow[] = []
  const downRankedRows: ServiceShopCohortDiagnosticRow[] = []
  const seen = new Set<string>()

  if (input.include_anchors !== false) {
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
      scoredRows.push({
        company_name: anchor.company_name,
        canonical_company_id: anchor.canonical_company_id,
        company_candidate_id: anchor.company_candidate_id,
        industry: "biomedical equipment service",
        source_tags: ["ps_he_anchor"],
        website: meta?.website ?? null,
        domain: meta?.domain ?? null,
        city: meta?.city ?? null,
        state: meta?.state ?? null,
        service_shop_score: shopScore.score,
        score_tier: shopScore.tier,
        up_signals: shopScore.up_signals.map((s) => s.label),
        down_rank_reason: shopScore.down_rank_reason,
        contact_count: contactCountByCompany.get(anchor.canonical_company_id) ?? 0,
      })
    }
  }

  for (const row of promotedRows ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    const company_candidate_id = asString(record.company_id)
    const company_name = asString(record.company_name)
    if (!canonical_company_id || !company_candidate_id || seen.has(canonical_company_id)) continue

    const meta = companyMetaById.get(canonical_company_id)
    const industry = asString(record.industry) || meta?.industry || null
    const source_tags = sourceTagsFromRow(record)
    const website = meta?.website ?? null
    const domain = meta?.domain ?? null
    const city = asString(record.city) || meta?.city || null
    const state = asString(record.state) || meta?.state || null

    const icpFit = evaluateBatchIcpFit({
      company_name,
      industry,
      source_tags,
      website,
      domain,
    })
    if (icpFit.decision !== "qualified") continue

    const shopScore = scoreServiceShopFit({
      company_name,
      industry,
      source_tags,
      website,
      domain,
    })

    const diagnostic: ServiceShopCohortDiagnosticRow = {
      company_name: company_name || "Unknown",
      canonical_company_id,
      company_candidate_id,
      industry,
      source_tags,
      website,
      domain,
      city,
      state,
      service_shop_score: shopScore.score,
      score_tier: shopScore.tier,
      up_signals: shopScore.up_signals.map((s) => s.label),
      down_rank_reason: shopScore.down_rank_reason,
      contact_count: contactCountByCompany.get(canonical_company_id) ?? 0,
    }

    seen.add(canonical_company_id)
    if (shopScore.down_ranked || shopScore.score < min_score) {
      downRankedRows.push(diagnostic)
      continue
    }
    scoredRows.push(diagnostic)
  }

  scoredRows.sort((a, b) => b.service_shop_score - a.service_shop_score)
  downRankedRows.sort((a, b) => b.service_shop_score - a.service_shop_score)

  const selectedRows = scoredRows.slice(0, limit)
  const cohort: BatchGraphExpansionCohortCompany[] = selectedRows.map((row) => ({
    company_candidate_id: row.company_candidate_id,
    canonical_company_id: row.canonical_company_id,
    company_name: row.company_name,
    search_query: "biomedical equipment service companies",
    contact_count: row.contact_count,
    enrichment_stale: true,
    cohort_kind: row.source_tags.includes("ps_he_anchor") ? "ps_he_anchor" : "stale",
  }))

  const score_distribution = { high: 0, medium: 0, low: 0 }
  for (const row of selectedRows) {
    score_distribution[row.score_tier] += 1
  }

  return {
    cohort,
    diagnostics: {
      companies_scored: scoredRows.length + downRankedRows.length,
      companies_selected: selectedRows.length,
      down_ranked_excluded: downRankedRows.length,
      score_distribution,
      selected: selectedRows,
      down_ranked_sample: downRankedRows.slice(0, down_ranked_sample_limit),
    },
  }
}
