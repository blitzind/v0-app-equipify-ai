import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  canonicalDisplayName,
  canonicalExactDomain,
  canonicalNormalizedCompanyName,
  canonicalNormalizedDomain,
} from "@/lib/growth/canonical-companies/canonical-company-normalize"
import type {
  GrowthCanonicalCompanyCandidateInput,
  GrowthCanonicalCompanyResolutionMethod,
} from "@/lib/growth/canonical-companies/canonical-company-types"
import { resolutionConfidenceFromMethod } from "@/lib/growth/canonical-companies/canonical-company-resolver"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export type InsertCanonicalCompanyPayload = {
  display_name: string
  normalized_name: string
  legal_name: string | null
  primary_domain: string | null
  website: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  industry: string | null
  subindustry: string | null
  employee_range: string | null
  revenue_range: string | null
  technologies: unknown[]
  identity_confidence: number
  resolution_method: GrowthCanonicalCompanyResolutionMethod
  first_observed_at: string
  last_observed_at: string
  metadata: Record<string, unknown>
}

export function buildCanonicalCompanyInsertPayload(
  input: GrowthCanonicalCompanyCandidateInput,
  method: GrowthCanonicalCompanyResolutionMethod,
): InsertCanonicalCompanyPayload {
  const now = new Date().toISOString()
  const normDomain = canonicalNormalizedDomain(input.domain, input.website)
  return {
    display_name: canonicalDisplayName(input.company_name),
    normalized_name: canonicalNormalizedCompanyName(input.company_name) ?? "",
    legal_name: input.legal_name ?? null,
    primary_domain: normDomain,
    website: input.website ?? null,
    phone: input.phone ?? null,
    address_line1: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    country: input.country ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    industry: input.industry ?? null,
    subindustry: input.subindustry ?? null,
    employee_range: input.employee_range ?? null,
    revenue_range: input.revenue_range ?? null,
    technologies: input.technologies ?? [],
    identity_confidence: resolutionConfidenceFromMethod(method, input.confidence),
    resolution_method: method,
    first_observed_at: input.observed_at ?? now,
    last_observed_at: input.observed_at ?? now,
    metadata: {
      qa_marker: "growth-canonical-company-7.2a-v1",
      first_source_table: input.source_table,
      first_source_id: input.source_id,
    },
  }
}

export async function insertCanonicalCompany(
  admin: SupabaseClient,
  payload: InsertCanonicalCompanyPayload,
): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("companies")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw new Error(`insertCanonicalCompany: ${error.message}`)
  return asString(data?.id)
}

export async function upsertCanonicalCompanyDomain(
  admin: SupabaseClient,
  input: {
    company_id: string
    domain: string
    normalized_domain: string
    is_primary: boolean
    source_table: string
    source_id: string
    observed_at: string
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("company_domains").upsert(
    {
      company_id: input.company_id,
      domain: input.domain,
      normalized_domain: input.normalized_domain,
      is_primary: input.is_primary,
      source_table: input.source_table,
      source_id: input.source_id,
      observed_at: input.observed_at,
    },
    { onConflict: "normalized_domain", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalCompanyDomain: ${error.message}`)
}

export async function upsertCanonicalCompanyLineage(
  admin: SupabaseClient,
  input: {
    company_id: string
    source_table: string
    source_id: string
    provider_name: string
    provider_type: string
    run_id: string | null
    confidence: number
    observed_at: string
    source_metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("company_source_lineage").upsert(
    {
      company_id: input.company_id,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      provider_type: input.provider_type,
      run_id: input.run_id,
      confidence: input.confidence,
      observed_at: input.observed_at,
      source_metadata: input.source_metadata,
    },
    { onConflict: "source_table,source_id", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalCompanyLineage: ${error.message}`)
}

export async function updateStagingCanonicalCompanyId(
  admin: SupabaseClient,
  sourceTable: GrowthCanonicalCompanyCandidateInput["source_table"],
  sourceId: string,
  canonicalCompanyId: string,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from(sourceTable)
    .update({ canonical_company_id: canonicalCompanyId })
    .eq("id", sourceId)
  if (error) throw new Error(`updateStagingCanonicalCompanyId(${sourceTable}): ${error.message}`)
}

export async function fetchLineageCompanyId(
  admin: SupabaseClient,
  sourceTable: string,
  sourceId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("company_source_lineage")
    .select("company_id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle()
  return data?.company_id ? asString(data.company_id) : null
}

export async function loadCanonicalCompanyIndexesFromDb(admin: SupabaseClient): Promise<{
  companies: Array<{ id: string; primary_domain: string | null; normalized_name: string; city: string | null; state: string | null }>
  domains: Array<{ company_id: string; domain: string; normalized_domain: string }>
}> {
  const { data: companies, error: cErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, primary_domain, normalized_name, city, state")
    .eq("status", "active")
    .limit(50000)
  if (cErr) throw new Error(`loadCanonicalCompanyIndexesFromDb: ${cErr.message}`)

  const { data: domains, error: dErr } = await admin
    .schema("growth")
    .from("company_domains")
    .select("company_id, domain, normalized_domain")
    .limit(50000)
  if (dErr) throw new Error(`loadCanonicalCompanyIndexesFromDb domains: ${dErr.message}`)

  return {
    companies: (companies ?? []) as Array<{
      id: string
      primary_domain: string | null
      normalized_name: string
      city: string | null
      state: string | null
    }>,
    domains: (domains ?? []) as Array<{
      company_id: string
      domain: string
      normalized_domain: string
    }>,
  }
}

export function domainRowsForCandidate(
  input: GrowthCanonicalCompanyCandidateInput,
  companyId: string,
): Array<{
  company_id: string
  domain: string
  normalized_domain: string
  is_primary: boolean
  source_table: string
  source_id: string
  observed_at: string
}> {
  const norm = canonicalNormalizedDomain(input.domain, input.website)
  if (!norm) return []
  const exact = canonicalExactDomain(input.domain) ?? norm
  const observed = input.observed_at ?? new Date().toISOString()
  return [
    {
      company_id: companyId,
      domain: exact,
      normalized_domain: norm,
      is_primary: true,
      source_table: input.source_table,
      source_id: input.source_id,
      observed_at: observed,
    },
  ]
}

export async function countCanonicalCompanies(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("companies")
    .select("id", { count: "exact", head: true })
  if (error) throw new Error(`countCanonicalCompanies: ${error.message}`)
  return count ?? 0
}
