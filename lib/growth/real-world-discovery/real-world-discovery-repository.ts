import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dedupeNormalizedRealWorldCandidates,
  normalizeRealWorldCompanyCandidate,
} from "@/lib/growth/real-world-discovery/real-world-company-normalizer"
import { resolveRealWorldCompanyInternalMatches } from "@/lib/growth/real-world-discovery/real-world-company-dedupe"
import { rankRealWorldCompanyCandidates } from "@/lib/growth/real-world-discovery/real-world-company-ranking"
import {
  runRealWorldDiscoveryProviders,
  summarizeRealWorldProviderStatus,
} from "@/lib/growth/real-world-discovery/real-world-discovery-registry"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { isGrowthRealWorldDiscoverySchemaReady } from "@/lib/growth/real-world-discovery/real-world-discovery-schema-health"
import {
  GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
  GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE,
  type GrowthRealWorldCompanyCandidate,
  type GrowthRealWorldCompanyDiscoveryRun,
  type GrowthRealWorldProviderStatusSummary,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToCandidate(row: Record<string, unknown>): GrowthRealWorldCompanyCandidate {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    run_id: asString(row.run_id),
    query: asString(row.query),
    industry: asString(row.industry) || null,
    location: asString(row.location) || null,
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    company_name: asString(row.company_name),
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    phone: asString(row.phone) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    category: asString(row.category) || null,
    description: asString(row.description) || null,
    rating: typeof row.rating === "number" ? row.rating : null,
    review_count: typeof row.review_count === "number" ? row.review_count : null,
    source_url: asString(row.source_url) || null,
    source_rank: typeof row.source_rank === "number" ? row.source_rank : null,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    dedupe_hash: asString(row.dedupe_hash),
    existing_customer_match: row.existing_customer_match === true,
    existing_prospect_match: row.existing_prospect_match === true,
    existing_growth_lead_match: row.existing_growth_lead_match === true,
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthRealWorldCompanyCandidate["evidence"]) : [],
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthRealWorldCompanyCandidate["source_attribution"])
      : [],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

const PUBLIC_CANDIDATE_COLUMNS =
  "id, created_at, updated_at, run_id, query, industry, location, provider_name, provider_type, company_name, website, domain, phone, address, city, state, country, category, description, rating, review_count, source_url, source_rank, confidence, dedupe_hash, existing_customer_match, existing_prospect_match, existing_growth_lead_match, evidence, source_attribution, metadata"

export type RunRealWorldCompanyDiscoveryInput = {
  query: string
  search_inputs: GrowthRealWorldDiscoverySearchInputs
  created_by?: string | null
  limit?: number
}

export type RunRealWorldCompanyDiscoveryResult = {
  qa_marker: typeof GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER
  schema_ready: boolean
  run: GrowthRealWorldCompanyDiscoveryRun | null
  candidates: GrowthRealWorldCompanyCandidate[]
  privacy_note: string
  provider_messages: string[]
  provider_status: GrowthRealWorldProviderStatusSummary
}

export async function runRealWorldCompanyDiscovery(
  admin: SupabaseClient,
  input: RunRealWorldCompanyDiscoveryInput,
): Promise<RunRealWorldCompanyDiscoveryResult> {
  const emptyStatus = summarizeRealWorldProviderStatus([])
  const base = {
    qa_marker: GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
    schema_ready: false,
    run: null,
    candidates: [] as GrowthRealWorldCompanyCandidate[],
    privacy_note: GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE,
    provider_messages: [] as string[],
    provider_status: emptyStatus,
  }

  const schema_ready = await isGrowthRealWorldDiscoverySchemaReady(admin)
  if (!schema_ready) return { ...base, schema_ready: false }

  const query = input.query.trim()
  const industry = input.search_inputs.industry?.trim() || null
  const location = input.search_inputs.location?.trim() || null
  const limit = input.limit ?? 50

  const providerQuery = {
    ...input.search_inputs,
    query,
    industry,
    location,
    limit,
  }

  const providerResults = await runRealWorldDiscoveryProviders(providerQuery, { admin })
  const useFixtureFallback = providerResults.some((r) => r.provider_type === "fixture")
  const provider_status = summarizeRealWorldProviderStatus(providerResults, {
    use_fixture_fallback: useFixtureFallback,
  })
  const provider_messages = providerResults.map(
    (r) => `${r.provider_name}: ${r.status} — ${r.message}`,
  )

  const normalized: Array<
    ReturnType<typeof normalizeRealWorldCompanyCandidate> & {
      provider_name: string
      provider_type: string
    }
  > = []

  for (const pr of providerResults) {
    if (pr.status !== "success") continue
    for (const raw of pr.candidates) {
      const row = normalizeRealWorldCompanyCandidate(
        raw,
        pr.provider_name,
        pr.provider_type,
        query,
      )
      if (row) {
        normalized.push({
          ...row,
          provider_name: pr.provider_name,
          provider_type: pr.provider_type,
        })
      }
    }
  }

  const deduped = dedupeNormalizedRealWorldCandidates(
    normalized.map(({ provider_name: _pn, provider_type: _pt, ...row }) => row),
  )
  const providerByHash = new Map(
    normalized.map((n) => [n.dedupe_hash, { provider_name: n.provider_name, provider_type: n.provider_type }]),
  )

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .insert({
      created_by: input.created_by ?? null,
      query,
      industry,
      location,
      provider_names: providerResults.map((r) => r.provider_name),
      status: providerResults.some((r) => r.status === "failed")
        ? deduped.length
          ? "partial"
          : "failed"
        : "completed",
      candidate_count: 0,
      error_message: runError ? runError.message : null,
      metadata: {
        qa_marker: GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
        provider_status: provider_status.label,
        provider_diagnostics: provider_status.provider_diagnostics ?? [],
        provider_fallback_reason: provider_status.provider_fallback_reason ?? null,
      },
    })
    .select("*")
    .single()

  if (runError || !runRow) {
    return {
      ...base,
      schema_ready: true,
      provider_messages,
      provider_status,
    }
  }

  const runId = asString((runRow as Record<string, unknown>).id)
  const inserts = []

  for (const row of deduped) {
    const matches = await resolveRealWorldCompanyInternalMatches(admin, row)
    const prov = providerByHash.get(row.dedupe_hash)
    inserts.push({
      run_id: runId,
      query,
      industry: row.industry ?? industry,
      location: row.location ?? location,
      provider_name: prov?.provider_name ?? "real_world_fixture",
      provider_type: prov?.provider_type ?? "fixture",
      company_name: row.company_name,
      website: row.website,
      domain: row.domain,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      category: row.category,
      description: row.description,
      rating: row.rating,
      review_count: row.review_count,
      source_url: row.source_url,
      source_rank: row.source_rank,
      confidence: row.confidence,
      dedupe_hash: row.dedupe_hash,
      existing_customer_match: matches.existing_customer_match,
      existing_prospect_match: matches.existing_prospect_match,
      existing_growth_lead_match: matches.existing_growth_lead_match,
      evidence: row.evidence,
      source_attribution: row.source_attribution,
      raw_payload_server_only: row.raw_payload_server_only,
      metadata: {
        matched_customer_id: matches.matched_customer_id,
        matched_prospect_id: matches.matched_prospect_id,
        matched_growth_lead_id: matches.matched_growth_lead_id,
        matched_lead_inbox_id: matches.matched_lead_inbox_id,
        matched_external_candidate_id: matches.matched_external_candidate_id,
        matched_real_world_candidate_id: matches.matched_real_world_candidate_id,
        existing_lead_inbox_match: matches.existing_lead_inbox_match,
        existing_external_candidate_match: matches.existing_external_candidate_match,
        existing_real_world_candidate_match: matches.existing_real_world_candidate_match,
        search_inputs: input.search_inputs,
        source_provider: prov?.provider_type ?? "fixture",
        google_place_id:
          typeof row.raw_payload_server_only?.google_place_id === "string"
            ? row.raw_payload_server_only.google_place_id
            : null,
        icp_fit_score:
          typeof row.raw_payload_server_only?.icp_fit_score === "number"
            ? row.raw_payload_server_only.icp_fit_score
            : null,
        google_places_icp_fit_score:
          typeof row.raw_payload_server_only?.icp_fit_score === "number"
            ? row.raw_payload_server_only.icp_fit_score
            : null,
        matched_queries: Array.isArray(row.raw_payload_server_only?.matched_queries)
          ? row.raw_payload_server_only.matched_queries
          : null,
        serp_place_id:
          typeof row.raw_payload_server_only?.serp_place_id === "string"
            ? row.raw_payload_server_only.serp_place_id
            : null,
        categories: Array.isArray(row.raw_payload_server_only?.categories)
          ? row.raw_payload_server_only.categories
          : null,
      },
    })
  }

  let stored: GrowthRealWorldCompanyCandidate[] = []
  if (inserts.length) {
    const { data: inserted, error: insertError } = await admin
      .schema("growth")
      .from("real_world_company_candidates")
      .insert(inserts)
      .select(PUBLIC_CANDIDATE_COLUMNS)

    if (!insertError && inserted?.length) {
      stored = inserted.map((r) => rowToCandidate(r as Record<string, unknown>))
    }
  }

  const ranked = rankRealWorldCompanyCandidates(stored, query, input.search_inputs, limit)

  await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .update({
      candidate_count: ranked.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)

  const r = runRow as Record<string, unknown>
  const run: GrowthRealWorldCompanyDiscoveryRun = {
    id: runId,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
    created_by: asString(r.created_by) || null,
    query: asString(r.query),
    industry: asString(r.industry) || null,
    location: asString(r.location) || null,
    provider_names: Array.isArray(r.provider_names) ? (r.provider_names as string[]) : [],
    status: asString(r.status) as GrowthRealWorldCompanyDiscoveryRun["status"],
    candidate_count: ranked.length,
    error_message: asString(r.error_message) || null,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
  }

  return {
    qa_marker: GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
    schema_ready: true,
    run,
    candidates: ranked,
    privacy_note: GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE,
    provider_messages,
    provider_status,
  }
}

export function toPublicRealWorldCandidates(
  rows: GrowthRealWorldCompanyCandidate[],
): GrowthRealWorldCompanyCandidate[] {
  return rows
}
