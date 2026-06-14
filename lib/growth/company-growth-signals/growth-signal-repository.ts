import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import { listCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"
import {
  GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
  GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
  type GrowthCompanyEvidenceSource,
  type GrowthCompanyGrowthSignal,
  type GrowthCompanyGrowthSignalScore,
  type GrowthCompanyGrowthSignalsSnapshot,
  type RawEvidenceSourceCandidate,
  type RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import {
  isGrowthCompanyGrowthSignalsSchemaReady,
  probeGrowthCompanyGrowthSignalsSchema,
} from "@/lib/growth/company-growth-signals/company-growth-signal-schema-health"
import { computeGrowthSignalScore } from "@/lib/growth/company-growth-signals/growth-signal-scoring"
import {
  discoverMultiSourceEvidence,
  evidenceDedupeHash,
  signalDedupeHash,
} from "@/lib/growth/company-growth-signals/website-evidence-discovery"

const SIGNAL_TTL_DAYS = 90

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function defaultExpiresAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + SIGNAL_TTL_DAYS)
  return date.toISOString()
}

function rowToEvidence(row: Record<string, unknown>): GrowthCompanyEvidenceSource {
  return {
    id: asString(row.id),
    company_id: asString(row.company_id),
    source_type: asString(row.source_type) as GrowthCompanyEvidenceSource["source_type"],
    source_url: asString(row.source_url) || null,
    confidence_score: Number(row.confidence_score ?? 0),
    evidence_excerpt: asString(row.evidence_excerpt),
    observed_at: asString(row.observed_at),
    expires_at: asString(row.expires_at) || null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }
}

function rowToSignal(row: Record<string, unknown>): GrowthCompanyGrowthSignal {
  return {
    id: asString(row.id),
    company_id: asString(row.company_id),
    signal_type: asString(row.signal_type) as GrowthCompanyGrowthSignal["signal_type"],
    confidence_score: Number(row.confidence_score ?? 0),
    source_type: asString(row.source_type) as GrowthCompanyGrowthSignal["source_type"],
    source_url: asString(row.source_url) || null,
    evidence_excerpt: asString(row.evidence_excerpt),
    detected_at: asString(row.detected_at),
    expires_at: asString(row.expires_at) || null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }
}

async function upsertEvidence(admin: SupabaseClient, companyId: string, items: RawEvidenceSourceCandidate[]) {
  for (const item of items) {
    if (!item.evidence_excerpt.trim()) continue
    const dedupe_hash = evidenceDedupeHash(companyId, item.source_type, item.evidence_excerpt)
    await admin.schema("growth").from("company_evidence_sources").upsert(
      {
        company_id: companyId,
        source_type: item.source_type,
        source_url: item.source_url,
        confidence_score: item.confidence_score,
        evidence_excerpt: item.evidence_excerpt,
        observed_at: new Date().toISOString(),
        expires_at: item.expires_at ?? defaultExpiresAt(),
        dedupe_hash,
        metadata: item.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,dedupe_hash" },
    )
  }
}

async function upsertSignals(admin: SupabaseClient, companyId: string, items: RawGrowthSignalCandidate[]) {
  for (const item of items) {
    if (!item.evidence_excerpt.trim()) continue
    await admin.schema("growth").from("company_growth_signals").insert({
      company_id: companyId,
      signal_type: item.signal_type,
      confidence_score: item.confidence_score,
      source_type: item.source_type,
      source_url: item.source_url,
      evidence_excerpt: item.evidence_excerpt,
      detected_at: new Date().toISOString(),
      expires_at: item.expires_at ?? defaultExpiresAt(),
      metadata: { dedupe_hash: signalDedupeHash(companyId, item.signal_type, item.evidence_excerpt), ...(item.metadata ?? {}) },
    })
  }
}

async function loadActiveSignals(admin: SupabaseClient, companyId: string): Promise<GrowthCompanyGrowthSignal[]> {
  const now = new Date().toISOString()
  const { data } = await admin
    .schema("growth")
    .from("company_growth_signals")
    .select("*")
    .eq("company_id", companyId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("confidence_score", { ascending: false })
    .limit(50)
  return (data ?? []).map((row) => rowToSignal(row as Record<string, unknown>))
}

async function loadEvidence(admin: SupabaseClient, companyId: string): Promise<GrowthCompanyEvidenceSource[]> {
  const { data } = await admin
    .schema("growth")
    .from("company_evidence_sources")
    .select("*")
    .eq("company_id", companyId)
    .order("observed_at", { ascending: false })
    .limit(50)
  return (data ?? []).map((row) => rowToEvidence(row as Record<string, unknown>))
}

async function persistScore(
  admin: SupabaseClient,
  companyId: string,
  score: GrowthCompanyGrowthSignalScore,
): Promise<GrowthCompanyGrowthSignalScore> {
  const payload = { ...score, company_id: companyId, updated_at: new Date().toISOString() }
  await admin.schema("growth").from("company_growth_signal_scores").upsert(payload)
  return payload
}

export async function runCompanyGrowthSignalDiscovery(
  admin: SupabaseClient,
  input: {
    company_id: string
    website?: string | null
    company_name: string
    description?: string | null
    review_count?: number | null
    rating?: number | null
    domain?: string | null
    website_maturity_score?: number | null
    icp_fit_score?: number | null
  },
): Promise<GrowthCompanyGrowthSignalsSnapshot> {
  if (!(await isGrowthCompanyGrowthSignalsSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
      schema_ready: false,
      company_id: input.company_id,
      evidence_sources: [],
      signals: [],
      score: null,
      privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
    }
  }

  const discovery = await discoverMultiSourceEvidence(input)
  await upsertEvidence(admin, input.company_id, discovery.evidence)
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from("company_growth_signals")
    .update({ expires_at: now, updated_at: now })
    .eq("company_id", input.company_id)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
  await upsertSignals(admin, input.company_id, discovery.signals)

  const signals = await loadActiveSignals(admin, input.company_id)

  if (process.env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED?.trim().toLowerCase() === "true") {
    const { bridgeCompanyGrowthSignalRow } = await import(
      "@/lib/growth/signal-intelligence/external-signal-producers"
    )
    for (const signal of signals) {
      void bridgeCompanyGrowthSignalRow(admin, {
        id: signal.id,
        company_id: input.company_id,
        signal_type: signal.signal_type,
        confidence_score: signal.confidence_score,
        detected_at: signal.detected_at,
      }).catch(() => undefined)
    }
  }

  const contacts = await listCompanyContacts(admin, input.company_id).catch(() => [])
  const coverage = computeCompanyContactCoverage(contacts)

  const score = computeGrowthSignalScore({
    signals,
    contact_coverage_score: coverage.coverage_score,
    website_maturity_score: input.website_maturity_score,
    icp_fit_score: input.icp_fit_score,
  })
  const persisted = await persistScore(admin, input.company_id, score)

  return {
    qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
    schema_ready: true,
    company_id: input.company_id,
    evidence_sources: await loadEvidence(admin, input.company_id),
    signals,
    score: persisted,
    privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
  }
}

export async function loadCompanyGrowthSignalsSnapshot(
  admin: SupabaseClient,
  companyId: string,
): Promise<GrowthCompanyGrowthSignalsSnapshot> {
  const schema_health = await probeGrowthCompanyGrowthSignalsSchema(admin)
  if (!schema_health.ready) {
    return {
      qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
      schema_ready: false,
      schema_health,
      company_id: companyId,
      evidence_sources: [],
      signals: [],
      score: null,
      privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
    }
  }

  const [{ data: scoreRow }, signals, evidence_sources] = await Promise.all([
    admin.schema("growth").from("company_growth_signal_scores").select("*").eq("company_id", companyId).maybeSingle(),
    loadActiveSignals(admin, companyId),
    loadEvidence(admin, companyId),
  ])

  return {
    qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
    schema_ready: true,
    schema_health,
    company_id: companyId,
    evidence_sources,
    signals,
    score: scoreRow
      ? {
          company_id: companyId,
          growth_signal_score: Number((scoreRow as Record<string, unknown>).growth_signal_score ?? 0),
          signal_tier: asString((scoreRow as Record<string, unknown>).signal_tier) as GrowthCompanyGrowthSignalScore["signal_tier"],
          top_signals: Array.isArray((scoreRow as Record<string, unknown>).top_signals)
            ? ((scoreRow as Record<string, unknown>).top_signals as GrowthCompanyGrowthSignalScore["top_signals"])
            : [],
          recommended_next_action: asString((scoreRow as Record<string, unknown>).recommended_next_action) || null,
          last_computed_at: asString((scoreRow as Record<string, unknown>).last_computed_at),
        }
      : null,
    privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
  }
}

export async function queueStaleCompanyGrowthSignalRefresh(admin: SupabaseClient, limit = 50): Promise<number> {
  const staleBefore = new Date(Date.now() - SIGNAL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("company_growth_signal_scores")
    .select("company_id")
    .lt("last_computed_at", staleBefore)
    .limit(limit)

  let queued = 0
  for (const row of data ?? []) {
    const companyId = asString((row as Record<string, unknown>).company_id)
    if (!companyId) continue
    const { error } = await admin.schema("growth").from("company_growth_signal_refresh_queue").upsert(
      { company_id: companyId, reason: "stale", status: "pending", scheduled_for: new Date().toISOString() },
      { onConflict: "company_id,reason" },
    )
    if (!error) queued += 1
  }
  return queued
}

export async function processCompanyGrowthSignalRefreshQueue(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ processed: number; failed: number }> {
  const { data } = await admin
    .schema("growth")
    .from("company_growth_signal_refresh_queue")
    .select("id, company_id")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    const companyId = asString((row as Record<string, unknown>).company_id)
    if (!queueId || !companyId) continue

    await admin.schema("growth").from("company_growth_signal_refresh_queue").update({ status: "running" }).eq("id", queueId)

    try {
      await runCompanyGrowthSignalDiscovery(admin, {
        company_id: companyId,
        company_name: "Company",
      })
      await admin
        .schema("growth")
        .from("company_growth_signal_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("company_growth_signal_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message : "Refresh failed",
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return { processed, failed }
}
