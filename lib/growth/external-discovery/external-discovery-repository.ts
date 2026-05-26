import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveExternalCompanyInternalMatches } from "@/lib/growth/external-discovery/external-company-dedupe"
import {
  dedupeNormalizedCandidates,
  normalizeExternalCompanyCandidate,
} from "@/lib/growth/external-discovery/external-company-normalizer"
import { rankExternalCompanyCandidates } from "@/lib/growth/external-discovery/external-company-ranking"
import { runExternalDiscoveryProviders } from "@/lib/growth/external-discovery/external-discovery-registry"
import { isGrowthExternalDiscoverySchemaReady } from "@/lib/growth/external-discovery/external-discovery-schema-health"
import {
  GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER,
  GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE,
  type GrowthExternalCompanyCandidate,
  type GrowthExternalCompanyDiscoveryRun,
} from "@/lib/growth/external-discovery/external-discovery-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToCandidate(row: Record<string, unknown>): GrowthExternalCompanyCandidate {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    run_id: asString(row.run_id),
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    query: asString(row.query),
    industry: asString(row.industry) || null,
    location: asString(row.location) || null,
    company_name: asString(row.company_name),
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    phone: asString(row.phone) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    category: asString(row.category) || null,
    rating: typeof row.rating === "number" ? row.rating : null,
    review_count: typeof row.review_count === "number" ? row.review_count : null,
    source_url: asString(row.source_url) || null,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    dedupe_hash: asString(row.dedupe_hash),
    existing_customer_match: row.existing_customer_match === true,
    existing_prospect_match: row.existing_prospect_match === true,
    existing_growth_lead_match: row.existing_growth_lead_match === true,
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthExternalCompanyCandidate["evidence"]) : [],
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthExternalCompanyCandidate["source_attribution"])
      : [],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export type RunExternalCompanyDiscoveryInput = {
  query: string
  industry?: string | null
  location?: string | null
  created_by?: string | null
  limit?: number
}

export type RunExternalCompanyDiscoveryResult = {
  qa_marker: typeof GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER
  schema_ready: boolean
  run: GrowthExternalCompanyDiscoveryRun | null
  candidates: GrowthExternalCompanyCandidate[]
  privacy_note: string
  provider_messages: string[]
}

export async function runExternalCompanyDiscovery(
  admin: SupabaseClient,
  input: RunExternalCompanyDiscoveryInput,
): Promise<RunExternalCompanyDiscoveryResult> {
  const base = {
    qa_marker: GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER,
    schema_ready: false,
    run: null,
    candidates: [] as GrowthExternalCompanyCandidate[],
    privacy_note: GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE,
    provider_messages: [] as string[],
  }

  const schema_ready = await isGrowthExternalDiscoverySchemaReady(admin)
  if (!schema_ready) return { ...base, schema_ready: false }

  const query = input.query.trim()
  const industry = input.industry?.trim() || null
  const location = input.location?.trim() || null
  const limit = input.limit ?? 50

  const providerResults = await runExternalDiscoveryProviders(
    { query, industry, location, limit },
    { provider_types: ["manual_import", "google_places", "serp"] },
  )

  const provider_messages = providerResults.map(
    (r) => `${r.provider_name}: ${r.status} — ${r.message}`,
  )

  const normalized: Array<
    ReturnType<typeof normalizeExternalCompanyCandidate> & {
      provider_name: string
      provider_type: string
    }
  > = []
  for (const pr of providerResults) {
    if (pr.status !== "success") continue
    for (const raw of pr.candidates) {
      const row = normalizeExternalCompanyCandidate(
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

  const deduped = dedupeNormalizedCandidates(
    normalized.map(({ provider_name: _pn, provider_type: _pt, ...row }) => row),
  )
  const providerByHash = new Map(
    normalized.map((n) => [n.dedupe_hash, { provider_name: n.provider_name, provider_type: n.provider_type }]),
  )

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("external_company_discovery_runs")
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
        : deduped.length
          ? "completed"
          : "completed",
      candidate_count: 0,
      error_message: runError ? runError.message : null,
      metadata: { qa_marker: GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER },
    })
    .select("*")
    .single()

  if (runError || !runRow) {
    return {
      ...base,
      schema_ready: true,
      provider_messages,
    }
  }

  const runId = asString((runRow as Record<string, unknown>).id)
  const inserts = []

  for (const row of deduped) {
    const matches = await resolveExternalCompanyInternalMatches(admin, row)
    const prov = providerByHash.get(row.dedupe_hash)
    inserts.push({
      run_id: runId,
      provider_name: prov?.provider_name ?? "manual_fixture",
      provider_type: prov?.provider_type ?? "manual_import",
      query,
      industry: row.industry ?? industry,
      location: row.location ?? location,
      company_name: row.company_name,
      website: row.website,
      domain: row.domain,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      category: row.category,
      rating: row.rating,
      review_count: row.review_count,
      source_url: row.source_url,
      confidence: row.confidence,
      dedupe_hash: row.dedupe_hash,
      existing_customer_match: matches.existing_customer_match,
      existing_prospect_match: matches.existing_prospect_match,
      existing_growth_lead_match: matches.existing_growth_lead_match,
      evidence: row.evidence,
      source_attribution: row.source_attribution,
      raw_payload: row.raw_payload,
      metadata: {
        matched_customer_id: matches.matched_customer_id,
        matched_prospect_id: matches.matched_prospect_id,
        matched_growth_lead_id: matches.matched_growth_lead_id,
      },
    })
  }

  let stored: GrowthExternalCompanyCandidate[] = []
  if (inserts.length) {
    const { data: inserted, error: insertError } = await admin
      .schema("growth")
      .from("external_company_candidates")
      .insert(inserts)
      .select(
        "id, created_at, updated_at, run_id, provider_name, provider_type, query, industry, location, company_name, website, domain, phone, address, city, state, country, category, rating, review_count, source_url, confidence, dedupe_hash, existing_customer_match, existing_prospect_match, existing_growth_lead_match, evidence, source_attribution, metadata",
      )

    if (!insertError && inserted?.length) {
      stored = inserted.map((r) => rowToCandidate(r as Record<string, unknown>))
    }
  }

  const ranked = rankExternalCompanyCandidates(stored, query, industry, location, limit)

  await admin
    .schema("growth")
    .from("external_company_discovery_runs")
    .update({
      candidate_count: ranked.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)

  const r = runRow as Record<string, unknown>
  const run: GrowthExternalCompanyDiscoveryRun = {
    id: runId,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
    created_by: asString(r.created_by) || null,
    query: asString(r.query),
    industry: asString(r.industry) || null,
    location: asString(r.location) || null,
    provider_names: Array.isArray(r.provider_names)
      ? (r.provider_names as string[])
      : [],
    status: asString(r.status) as GrowthExternalCompanyDiscoveryRun["status"],
    candidate_count: ranked.length,
    error_message: asString(r.error_message) || null,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
  }

  return {
    qa_marker: GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER,
    schema_ready: true,
    run,
    candidates: ranked,
    privacy_note: GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE,
    provider_messages,
  }
}

/** Strip raw_payload for API responses. */
export function toPublicExternalCandidates(
  rows: GrowthExternalCompanyCandidate[],
): GrowthExternalCompanyCandidate[] {
  return rows
}
