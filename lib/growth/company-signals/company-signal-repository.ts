import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCompanySignalUiSummary,
  normalizeDetectedCompanySignals,
} from "@/lib/growth/company-signals/company-signal-engine"
import type { GrowthCompanySignalContext } from "@/lib/growth/company-signals/company-signal-context"
import { probeGrowthCompanySignalSchema } from "@/lib/growth/company-signals/company-signal-schema-health"
import {
  GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
  GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
  type GrowthCompanySignal,
  type GrowthCompanySignalRun,
  type GrowthCompanySignalSnapshot,
} from "@/lib/growth/company-signals/company-signal-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const PUBLIC_SIGNAL_COLUMNS =
  "id, created_at, updated_at, run_id, company_candidate_id, signal_category, signal_type, signal_value, confidence, evidence, source_attribution, observed_at, metadata"

function rowToSignal(row: Record<string, unknown>): GrowthCompanySignal {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    run_id: asString(row.run_id),
    company_candidate_id: asString(row.company_candidate_id),
    signal_category: asString(row.signal_category) as GrowthCompanySignal["signal_category"],
    signal_type: asString(row.signal_type),
    signal_value: asString(row.signal_value),
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthCompanySignal["evidence"]) : [],
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthCompanySignal["source_attribution"])
      : [],
    observed_at: asString(row.observed_at),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

async function loadCompanyRow(
  admin: SupabaseClient,
  table: "real_world_company_candidates" | "external_company_candidates",
  companyCandidateId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from(table)
    .select(
      "id, company_name, domain, website, industry, category, description, location, city, state, country, review_count, rating, metadata",
    )
    .eq("id", companyCandidateId)
    .maybeSingle()
  return data ? (data as Record<string, unknown>) : null
}

async function loadObservedEnrichmentSignals(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<{
  technology_signals: string[]
  crm_signals: string[]
  service_signals: string[]
}> {
  const empty = { technology_signals: [] as string[], crm_signals: [] as string[], service_signals: [] as string[] }
  try {
    const { data } = await admin
      .schema("growth")
      .from("company_enrichments")
      .select("technology_signals, crm_signals, service_signals")
      .eq("company_candidate_id", companyCandidateId)
      .eq("provider_type", "internal_growth")
      .order("confidence", { ascending: false })
      .limit(3)

    const tech: string[] = []
    const crm: string[] = []
    const svc: string[] = []
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      if (Array.isArray(r.technology_signals)) {
        tech.push(...(r.technology_signals as string[]).filter((s) => typeof s === "string"))
      }
      if (Array.isArray(r.crm_signals)) {
        crm.push(...(r.crm_signals as string[]).filter((s) => typeof s === "string"))
      }
      if (Array.isArray(r.service_signals)) {
        svc.push(...(r.service_signals as string[]).filter((s) => typeof s === "string"))
      }
    }
    return {
      technology_signals: [...new Set(tech)],
      crm_signals: [...new Set(crm)],
      service_signals: [...new Set(svc)],
    }
  } catch {
    return empty
  }
}

export async function resolveCompanySignalContext(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<GrowthCompanySignalContext | null> {
  const row =
    (await loadCompanyRow(admin, "real_world_company_candidates", companyCandidateId)) ??
    (await loadCompanyRow(admin, "external_company_candidates", companyCandidateId))
  if (!row) return null

  const enrichment = await loadObservedEnrichmentSignals(admin, companyCandidateId)

  return {
    company_candidate_id: asString(row.id),
    company_name: asString(row.company_name),
    domain: asString(row.domain) || null,
    website: asString(row.website) || null,
    industry: asString(row.industry) || null,
    category: asString(row.category) || null,
    description: asString(row.description) || null,
    location: asString(row.location) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    review_count: typeof row.review_count === "number" ? row.review_count : null,
    rating: typeof row.rating === "number" ? row.rating : null,
    observed_technology_signals: enrichment.technology_signals,
    observed_crm_signals: enrichment.crm_signals,
    observed_service_signals: enrichment.service_signals,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export async function runCompanySignalIntelligence(
  admin: SupabaseClient,
  input: { company_candidate_id: string; created_by?: string | null },
): Promise<GrowthCompanySignalSnapshot> {
  const base: GrowthCompanySignalSnapshot = {
    qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
    schema_ready: false,
    company_candidate_id: input.company_candidate_id,
    run: null,
    signals: [],
    ui_summary: buildCompanySignalUiSummary([]),
    privacy_note: GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
  }

  const schema_health = await probeGrowthCompanySignalSchema(admin)
  const schema_ready = schema_health.ready
  if (!schema_ready) return { ...base, schema_ready: false, schema_health }

  const ctx = await resolveCompanySignalContext(admin, input.company_candidate_id)
  if (!ctx) return { ...base, schema_ready: true }

  const normalized = normalizeDetectedCompanySignals(ctx)

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("company_signal_runs")
    .insert({
      company_candidate_id: input.company_candidate_id,
      status: "completed",
      signal_count: 0,
      error_message: runError ? runError.message : null,
      metadata: {
        qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
        created_by: input.created_by ?? null,
      },
    })
    .select("*")
    .single()

  if (runError || !runRow) {
    return { ...base, schema_ready: true }
  }

  const runId = asString((runRow as Record<string, unknown>).id)
  const inserts = normalized.map((row) => ({
    run_id: runId,
    company_candidate_id: input.company_candidate_id,
    signal_category: row.signal_category,
    signal_type: row.signal_type,
    signal_value: row.signal_value,
    confidence: row.confidence,
    evidence: row.evidence,
    source_attribution: row.source_attribution,
    observed_at: row.observed_at,
    dedupe_hash: row.dedupe_hash,
    metadata: row.metadata,
  }))

  let stored: GrowthCompanySignal[] = []
  if (inserts.length) {
    const { data: inserted, error: insertError } = await admin
      .schema("growth")
      .from("company_signals")
      .insert(inserts)
      .select(PUBLIC_SIGNAL_COLUMNS)

    if (!insertError && inserted?.length) {
      stored = inserted.map((r) => rowToSignal(r as Record<string, unknown>))
    }
  }

  await admin
    .schema("growth")
    .from("company_signal_runs")
    .update({
      signal_count: stored.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)

  const r = runRow as Record<string, unknown>
  const run: GrowthCompanySignalRun = {
    id: runId,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
    company_candidate_id: input.company_candidate_id,
    status: asString(r.status) as GrowthCompanySignalRun["status"],
    signal_count: stored.length,
    error_message: asString(r.error_message) || null,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
  }

  return {
    qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
    schema_ready: true,
    schema_health,
    company_candidate_id: input.company_candidate_id,
    run,
    signals: stored,
    ui_summary: buildCompanySignalUiSummary(stored),
    privacy_note: GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
  }
}

export async function loadCompanySignalSnapshot(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<GrowthCompanySignalSnapshot> {
  const base: GrowthCompanySignalSnapshot = {
    qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
    schema_ready: false,
    company_candidate_id: companyCandidateId,
    run: null,
    signals: [],
    ui_summary: buildCompanySignalUiSummary([]),
    privacy_note: GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
  }

  const schema_health = await probeGrowthCompanySignalSchema(admin)
  const schema_ready = schema_health.ready
  if (!schema_ready) return { ...base, schema_ready: false, schema_health }

  const { data: runRow } = await admin
    .schema("growth")
    .from("company_signal_runs")
    .select("*")
    .eq("company_candidate_id", companyCandidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!runRow) {
    return { ...base, schema_ready: true, schema_health }
  }

  const r = runRow as Record<string, unknown>
  const runId = asString(r.id)
  const { data: signalRows } = await admin
    .schema("growth")
    .from("company_signals")
    .select(PUBLIC_SIGNAL_COLUMNS)
    .eq("run_id", runId)
    .order("confidence", { ascending: false })

  const signals = (signalRows ?? []).map((row) => rowToSignal(row as Record<string, unknown>))
  const run: GrowthCompanySignalRun = {
    id: runId,
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
    company_candidate_id: companyCandidateId,
    status: asString(r.status) as GrowthCompanySignalRun["status"],
    signal_count: signals.length,
    error_message: asString(r.error_message) || null,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
  }

  return {
    qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
    schema_ready: true,
    schema_health,
    company_candidate_id: companyCandidateId,
    run,
    signals,
    ui_summary: buildCompanySignalUiSummary(signals),
    privacy_note: GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
  }
}
