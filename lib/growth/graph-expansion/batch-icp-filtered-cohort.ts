/** Phase 7.PS-IF — Load ICP-qualified promoted companies for batch expansion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateBatchIcpFit } from "@/lib/growth/graph-expansion/batch-icp-filter"
import type {
  BatchIcpCohortDiagnosticRow,
  BatchIcpFilteredCohortDiagnostics,
} from "@/lib/growth/graph-expansion/batch-icp-filter-types"
import {
  DEFAULT_BATCH_GRAPH_EXPANSION_STALE_ENRICHMENT_DAYS,
  type BatchGraphExpansionCohortCompany,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isStaleEnrichment(updated_at: string | null, contact_count: number): boolean {
  if (contact_count === 0) return true
  if (!updated_at) return true
  const ageMs = Date.now() - new Date(updated_at).getTime()
  const staleMs = DEFAULT_BATCH_GRAPH_EXPANSION_STALE_ENRICHMENT_DAYS * 24 * 60 * 60 * 1000
  return ageMs > staleMs
}

function sourceTagsFromRow(row: Record<string, unknown>): string[] {
  const tags = new Set<string>()
  const industry = asString(row.industry)
  const source_type = asString(row.source_type)
  const discovery_source_type = asString(row.discovery_source_type)
  if (industry) tags.add(industry)
  if (source_type) tags.add(source_type)
  if (discovery_source_type) tags.add(discovery_source_type)

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

export async function loadBatchIcpFilteredCohort(
  admin: SupabaseClient,
  input: {
    limit?: number
    scan_limit?: number
    include_anchors?: boolean
    only_unenriched?: boolean
    excluded_sample_limit?: number
  } = {},
): Promise<{
  cohort: BatchGraphExpansionCohortCompany[]
  diagnostics: BatchIcpFilteredCohortDiagnostics
}> {
  const limit = input.limit ?? 25
  const scan_limit = input.scan_limit ?? 400
  const excluded_sample_limit = input.excluded_sample_limit ?? 30

  const { data: promotedRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, company_id, company_name, canonical_company_id, industry, source_type, discovery_source_type, metadata, updated_at",
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

  const websiteByCompany = new Map<
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
      const website = asString((row as Record<string, unknown>).website) || null
      const domain = asString((row as Record<string, unknown>).primary_domain) || null
      const companyIndustry = asString((row as Record<string, unknown>).industry) || null
      websiteByCompany.set(id, { website, domain, industry: companyIndustry })
    }
  }

  const contactCountByCompany = new Map<string, { count: number; last_updated: string | null }>()
  if (canonicalIds.length > 0) {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("company_id, updated_at")
      .in("company_id", canonicalIds)
      .neq("contact_status", "archived")

    for (const row of contacts ?? []) {
      const company_id = asString((row as Record<string, unknown>).company_id)
      if (!company_id) continue
      const prior = contactCountByCompany.get(company_id) ?? { count: 0, last_updated: null }
      const updated_at = asString((row as Record<string, unknown>).updated_at) || null
      contactCountByCompany.set(company_id, {
        count: prior.count + 1,
        last_updated:
          !prior.last_updated || (updated_at && updated_at > prior.last_updated)
            ? updated_at
            : prior.last_updated,
      })
    }
  }

  const selectedDiagnostics: BatchIcpCohortDiagnosticRow[] = []
  const excludedDiagnostics: BatchIcpCohortDiagnosticRow[] = []
  const cohort: BatchGraphExpansionCohortCompany[] = []
  const seen = new Set<string>()

  if (input.include_anchors !== false) {
    for (const anchor of GROWTH_PS_HE_ANCHOR_COMPANIES) {
      if (cohort.length >= limit) break
      seen.add(anchor.canonical_company_id)
      const contactMeta = contactCountByCompany.get(anchor.canonical_company_id) ?? {
        count: 0,
        last_updated: null,
      }
      const websiteMeta = websiteByCompany.get(anchor.canonical_company_id)
      selectedDiagnostics.push({
        company_name: anchor.company_name,
        canonical_company_id: anchor.canonical_company_id,
        company_candidate_id: anchor.company_candidate_id,
        industry: "biomedical equipment service",
        source_tags: ["ps_he_anchor"],
        website: websiteMeta?.website ?? null,
        domain: websiteMeta?.domain ?? null,
        decision: "qualified",
        icp_match_reason: "ps_he_anchor",
        exclusion_reason: null,
        contact_count: contactMeta.count,
      })
      cohort.push({
        company_candidate_id: anchor.company_candidate_id,
        canonical_company_id: anchor.canonical_company_id,
        company_name: anchor.company_name,
        search_query: anchor.search_query,
        contact_count: contactMeta.count,
        enrichment_stale: true,
        cohort_kind: "ps_he_anchor",
      })
    }
  }

  for (const row of promotedRows ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    const company_candidate_id = asString(record.company_id)
    const company_name = asString(record.company_name)
    if (!canonical_company_id || !company_candidate_id || seen.has(canonical_company_id)) continue

    const websiteMeta = websiteByCompany.get(canonical_company_id)
    const industry = asString(record.industry) || websiteMeta?.industry || null
    const source_tags = sourceTagsFromRow(record)
    const website = websiteMeta?.website ?? null
    const domain = websiteMeta?.domain ?? null

    const fit = evaluateBatchIcpFit({
      company_name,
      industry,
      source_tags,
      website,
      domain,
    })

    const contactMeta = contactCountByCompany.get(canonical_company_id) ?? {
      count: 0,
      last_updated: null,
    }
    const enrichment_stale = isStaleEnrichment(contactMeta.last_updated, contactMeta.count)

    const diagnostic: BatchIcpCohortDiagnosticRow = {
      company_name: company_name || "Unknown",
      canonical_company_id,
      company_candidate_id,
      industry,
      source_tags,
      website,
      domain,
      decision: fit.decision,
      icp_match_reason: fit.icp_match_reason,
      exclusion_reason: fit.exclusion_reason,
      contact_count: contactMeta.count,
    }

    seen.add(canonical_company_id)

    if (fit.decision === "excluded") {
      excludedDiagnostics.push(diagnostic)
      continue
    }

    if (input.only_unenriched !== false && contactMeta.count > 0 && !enrichment_stale) {
      excludedDiagnostics.push({
        ...diagnostic,
        decision: "excluded",
        icp_match_reason: fit.icp_match_reason,
        exclusion_reason: "already_enriched",
      })
      continue
    }

    selectedDiagnostics.push(diagnostic)
    cohort.push({
      company_candidate_id,
      canonical_company_id,
      company_name: company_name || "Unknown",
      search_query: "biomedical equipment service companies",
      contact_count: contactMeta.count,
      enrichment_stale,
      cohort_kind: contactMeta.count === 0 ? "unenriched" : "stale",
    })

    if (cohort.length >= limit) break
  }

  return {
    cohort: cohort.slice(0, limit),
    diagnostics: {
      icp_qualified_count: selectedDiagnostics.length,
      off_icp_excluded_count: excludedDiagnostics.length,
      selected: selectedDiagnostics.slice(0, limit),
      excluded_sample: excludedDiagnostics.slice(0, excluded_sample_limit),
    },
  }
}
