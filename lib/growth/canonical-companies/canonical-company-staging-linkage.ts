import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  fetchLineageCompanyId,
  updateStagingCanonicalCompanyId,
  upsertCanonicalCompanyLineage,
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
import type { GrowthCanonicalCompanySourceTable } from "@/lib/growth/canonical-companies/canonical-company-types"

export const GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER =
  "growth-canonical-company-staging-linkage-7-ps-hm-link-v1" as const

const STAGING_TABLES = [
  "discovery_candidates",
  "real_world_company_candidates",
  "external_company_candidates",
] as const satisfies readonly GrowthCanonicalCompanySourceTable[]
export type GrowthStagingCompanyCandidateTable = (typeof STAGING_TABLES)[number]

export type StagingCanonicalCompanyResolutionMethod =
  | "staging_column"
  | "company_source_lineage"
  | "company_contacts"
  | "companies_primary_domain"
  | "company_domains_alias"
  | "canonical_backfill"
  | "explicit"
  | "unresolved"

export type StagingCanonicalCompanyResolution = {
  qa_marker: typeof GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER
  company_candidate_id: string
  source_table: GrowthStagingCompanyCandidateTable | null
  canonical_company_id: string | null
  method: StagingCanonicalCompanyResolutionMethod
  persisted: boolean
  lineage_upserted: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stagingProviderFields(
  row: Record<string, unknown>,
  source_table: GrowthStagingCompanyCandidateTable,
): { provider_name: string; provider_type: string } {
  if (source_table === "discovery_candidates") {
    return {
      provider_name: "discovery_candidates",
      provider_type: asString(row.discovery_source_type) || asString(row.source_type) || "discovery",
    }
  }
  return {
    provider_name: asString(row.provider_name) || "prospect_search",
    provider_type: asString(row.provider_type) || "manual_import",
  }
}

function selectForStagingTable(table: GrowthStagingCompanyCandidateTable): string {
  if (table === "discovery_candidates") {
    return "id, company_id, canonical_company_id, domain, website, company_name, run_id, source_type, discovery_source_type, source_confidence, metadata"
  }
  return "id, canonical_company_id, domain, website, company_name, provider_name, provider_type, run_id, confidence, metadata"
}

function stagingRowId(row: Record<string, unknown>): string {
  return asString(row.id)
}

async function loadDiscoveryCandidateStagingRow(
  admin: SupabaseClient,
  lookupKey: string,
): Promise<Record<string, unknown> | null> {
  const select = selectForStagingTable("discovery_candidates")
  const { data: byId } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(select)
    .eq("id", lookupKey)
    .maybeSingle()
  if (byId) return byId as Record<string, unknown>

  const { data: byCompanyId } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select(select)
    .eq("company_id", lookupKey)
    .maybeSingle()
  return (byCompanyId as Record<string, unknown> | null) ?? null
}

export type LoadedStagingCompanyCandidateRow = {
  source_table: GrowthStagingCompanyCandidateTable
  row: Record<string, unknown>
  staging_row_id: string
  lookup_key: string
}

export async function loadStagingCompanyCandidateRow(
  admin: SupabaseClient,
  lookupKey: string,
  preferredTable?: GrowthStagingCompanyCandidateTable,
): Promise<LoadedStagingCompanyCandidateRow | null> {
  const key = asString(lookupKey)
  if (!key) return null

  const tables = preferredTable ? [preferredTable] : STAGING_TABLES
  for (const table of tables) {
    if (table === "discovery_candidates") {
      const row = await loadDiscoveryCandidateStagingRow(admin, key)
      if (row) {
        const id = stagingRowId(row)
        if (!id) continue
        return { source_table: table, row, staging_row_id: id, lookup_key: key }
      }
      continue
    }

    const { data } = await admin
      .schema("growth")
      .from(table)
      .select(selectForStagingTable(table))
      .eq("id", key)
      .maybeSingle()
    if (data) {
      const row = data as Record<string, unknown>
      const id = stagingRowId(row)
      if (!id) continue
      return { source_table: table, row, staging_row_id: id, lookup_key: key }
    }
  }
  return null
}

async function loadStagingRow(
  admin: SupabaseClient,
  companyCandidateId: string,
  preferredTable?: GrowthStagingCompanyCandidateTable,
): Promise<{
  source_table: GrowthStagingCompanyCandidateTable
  row: Record<string, unknown>
  staging_row_id: string
} | null> {
  const loaded = await loadStagingCompanyCandidateRow(admin, companyCandidateId, preferredTable)
  if (!loaded) return null
  return {
    source_table: loaded.source_table,
    row: loaded.row,
    staging_row_id: loaded.staging_row_id,
  }
}

async function resolveFromCompanyContacts(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<string | null> {
  const { data: contactCandidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id")
    .eq("company_candidate_id", companyCandidateId)
    .limit(20)

  const candidateIds = (contactCandidates ?? []).map((row) => asString(row.id)).filter(Boolean)
  if (candidateIds.length === 0) return null

  const { data: companyContacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("company_id")
    .in("contact_candidate_id", candidateIds)
    .limit(20)

  const companyIds = [
    ...new Set((companyContacts ?? []).map((row) => asString(row.company_id)).filter(Boolean)),
  ]
  if (companyIds.length === 1) return companyIds[0]!
  if (companyIds.length === 0) return null

  const staging = await loadStagingRow(admin, companyCandidateId)
  const domain = staging
    ? canonicalNormalizedDomain(asString(staging.row.domain), asString(staging.row.website))
    : null
  if (!domain) return companyIds[0]!

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .eq("status", "active")
    .maybeSingle()
  const preferred = asString(company?.id)
  if (preferred && companyIds.includes(preferred)) return preferred
  return companyIds[0]!
}

async function resolveFromDomain(
  admin: SupabaseClient,
  domain: string | null,
): Promise<{ company_id: string; method: "companies_primary_domain" | "company_domains_alias" } | null> {
  if (!domain) return null

  const { data: primary } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .eq("status", "active")
    .maybeSingle()
  const primaryId = asString(primary?.id)
  if (primaryId) return { company_id: primaryId, method: "companies_primary_domain" }

  const { data: alias } = await admin
    .schema("growth")
    .from("company_domains")
    .select("company_id")
    .eq("normalized_domain", domain)
    .limit(1)
    .maybeSingle()
  const aliasId = asString(alias?.company_id)
  if (aliasId) return { company_id: aliasId, method: "company_domains_alias" }
  return null
}

export async function resolveStagingCanonicalCompanyId(
  admin: SupabaseClient,
  companyCandidateId: string,
  input?: {
    explicit_canonical_company_id?: string | null
    preferred_source_table?: GrowthStagingCompanyCandidateTable
  },
): Promise<StagingCanonicalCompanyResolution> {
  const company_candidate_id = asString(companyCandidateId)
  const base = {
    qa_marker: GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
    company_candidate_id,
    source_table: null as GrowthStagingCompanyCandidateTable | null,
    canonical_company_id: null as string | null,
    method: "unresolved" as StagingCanonicalCompanyResolutionMethod,
    persisted: false,
    lineage_upserted: false,
  }

  if (!company_candidate_id) return base

  const explicit = asString(input?.explicit_canonical_company_id)
  if (explicit) {
    return {
      ...base,
      canonical_company_id: explicit,
      method: "explicit",
    }
  }

  const staging = await loadStagingRow(admin, company_candidate_id, input?.preferred_source_table)
  if (!staging) return base
  base.source_table = staging.source_table

  const columnId = asString(staging.row.canonical_company_id)
  if (columnId) {
    return {
      ...base,
      canonical_company_id: columnId,
      method: "staging_column",
    }
  }

  const lineageId = await fetchLineageCompanyId(
    admin,
    staging.source_table,
    staging.staging_row_id,
  )
  if (lineageId) {
    return {
      ...base,
      canonical_company_id: lineageId,
      method: "company_source_lineage",
    }
  }

  const fromContacts = await resolveFromCompanyContacts(admin, company_candidate_id)
  if (fromContacts) {
    return {
      ...base,
      canonical_company_id: fromContacts,
      method: "company_contacts",
    }
  }

  const domain = canonicalNormalizedDomain(
    asString(staging.row.domain),
    asString(staging.row.website),
  )
  const fromDomain = await resolveFromDomain(admin, domain)
  if (fromDomain) {
    return {
      ...base,
      canonical_company_id: fromDomain.company_id,
      method: fromDomain.method,
    }
  }

  return base
}

export async function ensureStagingCanonicalCompanyLinkage(
  admin: SupabaseClient,
  companyCandidateId: string,
  input?: {
    explicit_canonical_company_id?: string | null
    upsert_lineage?: boolean
  },
): Promise<StagingCanonicalCompanyResolution> {
  const resolution = await resolveStagingCanonicalCompanyId(admin, companyCandidateId, {
    explicit_canonical_company_id: input?.explicit_canonical_company_id,
  })

  if (!resolution.canonical_company_id || !resolution.source_table) {
    return resolution
  }

  const staging = await loadStagingRow(admin, companyCandidateId, resolution.source_table)
  if (!staging) return resolution

  const stagingRowId = staging.staging_row_id
  const columnId = asString(staging.row.canonical_company_id)
  if (columnId !== resolution.canonical_company_id) {
    await updateStagingCanonicalCompanyId(
      admin,
      resolution.source_table,
      stagingRowId,
      resolution.canonical_company_id,
    )
    resolution.persisted = true
  }

  if (input?.upsert_lineage !== false) {
    const existingLineage = await fetchLineageCompanyId(
      admin,
      resolution.source_table,
      stagingRowId,
    )
    if (!existingLineage) {
      const provider = stagingProviderFields(staging.row, resolution.source_table)
      await upsertCanonicalCompanyLineage(admin, {
        company_id: resolution.canonical_company_id,
        source_table: resolution.source_table,
        source_id: stagingRowId,
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        run_id: asString(staging.row.run_id) || null,
        confidence:
          typeof staging.row.confidence === "number"
            ? staging.row.confidence
            : typeof staging.row.source_confidence === "number"
              ? staging.row.source_confidence
              : 0,
        observed_at: new Date().toISOString(),
        source_metadata: {
          qa_marker: GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
          linkage_method: resolution.method,
          lookup_key: companyCandidateId,
        },
      })
      resolution.lineage_upserted = true
    }
  }

  return resolution
}

export async function backfillStagingCanonicalCompanyLinkage(
  admin: SupabaseClient,
  input?: {
    company_candidate_ids?: string[]
    limit?: number
    mode?: "dry_run" | "apply"
  },
): Promise<{
  qa_marker: typeof GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER
  mode: "dry_run" | "apply"
  processed: number
  linked: number
  lineage_upserted: number
  unresolved: number
  results: Array<{
    company_candidate_id: string
    canonical_company_id: string | null
    method: StagingCanonicalCompanyResolutionMethod
    persisted: boolean
  }>
}> {
  const mode = input?.mode ?? "apply"
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500)
  let candidateIds = (input?.company_candidate_ids ?? []).map(asString).filter(Boolean)

  if (candidateIds.length === 0) {
    const { data } = await admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id")
      .is("canonical_company_id", null)
      .order("created_at", { ascending: false })
      .limit(limit)
    candidateIds = (data ?? []).map((row) => asString(row.id)).filter(Boolean)
  }

  const results: Array<{
    company_candidate_id: string
    canonical_company_id: string | null
    method: StagingCanonicalCompanyResolutionMethod
    persisted: boolean
  }> = []

  let linked = 0
  let lineage_upserted = 0
  let unresolved = 0

  for (const company_candidate_id of candidateIds.slice(0, limit)) {
    const resolution =
      mode === "apply"
        ? await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id)
        : await resolveStagingCanonicalCompanyId(admin, company_candidate_id)

    results.push({
      company_candidate_id,
      canonical_company_id: resolution.canonical_company_id,
      method: resolution.method,
      persisted: resolution.persisted,
    })

    if (resolution.canonical_company_id) {
      linked++
      if (resolution.lineage_upserted) lineage_upserted++
    } else {
      unresolved++
    }
  }

  return {
    qa_marker: GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
    mode,
    processed: results.length,
    linked,
    lineage_upserted,
    unresolved,
    results,
  }
}

export async function countUnlinkedStagingCompanyCandidates(
  admin: SupabaseClient,
  table: GrowthStagingCompanyCandidateTable = "real_world_company_candidates",
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("canonical_company_id", null)
  if (error) throw new Error(`countUnlinkedStagingCompanyCandidates: ${error.message}`)
  return count ?? 0
}
