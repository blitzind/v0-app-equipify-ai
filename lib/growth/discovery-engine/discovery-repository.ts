import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_DISCOVERY_ENGINE_PRIVACY_NOTE,
  GROWTH_DISCOVERY_ENGINE_QA_MARKER,
  type GrowthDiscoveryCandidate,
  type GrowthDiscoveryRun,
  type GrowthDiscoverySegment,
} from "@/lib/growth/discovery-engine/discovery-engine-types"
import { isGrowthDiscoveryEngineSchemaReady } from "@/lib/growth/discovery-engine/discovery-engine-schema-health"
import { GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS } from "@/lib/growth/discovery-engine/discovery-segments"
import {
  applyDiscoveryPriorityBoost,
  buildDiscoveryPatternKey,
  computeDiscoveryPriorityBoost,
} from "@/lib/growth/market-intelligence/discovery-feedback-loop"

const HIGH_FIT_CONFIDENCE = 0.72

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function discoveryDedupeHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

function rowToRun(row: Record<string, unknown>): GrowthDiscoveryRun {
  return {
    id: asString(row.id),
    run_type: asString(row.run_type) as GrowthDiscoveryRun["run_type"],
    segment_key: asString(row.segment_key) || null,
    discovery_source_type: asString(row.discovery_source_type) as GrowthDiscoveryRun["discovery_source_type"],
    query_text: asString(row.query_text),
    industry: asString(row.industry) || null,
    territory_id: asString(row.territory_id) || null,
    status: asString(row.status) as GrowthDiscoveryRun["status"],
    new_companies_found: Number(row.new_companies_found ?? 0),
    duplicates_skipped: Number(row.duplicates_skipped ?? 0),
    high_fit_found: Number(row.high_fit_found ?? 0),
    territory_matches: Number(row.territory_matches ?? 0),
    signal_matches: Number(row.signal_matches ?? 0),
    error_message: asString(row.error_message) || null,
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthDiscoveryRun["evidence"]) : [],
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    started_at: asString(row.started_at) || null,
    completed_at: asString(row.completed_at) || null,
    created_at: asString(row.created_at),
  }
}

async function loadExistingDiscoveryHashes(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.schema("growth").from("discovery_candidates").select("dedupe_hash").limit(5000)
  return new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).dedupe_hash)).filter(Boolean))
}

async function upsertDiscoveryStatistics(
  admin: SupabaseClient,
  segmentKey: string,
  sourceType: string,
  stats: Pick<
    GrowthDiscoveryRun,
    "new_companies_found" | "duplicates_skipped" | "high_fit_found" | "territory_matches" | "signal_matches"
  >,
) {
  const statDate = new Date().toISOString().slice(0, 10)
  const { data } = await admin
    .schema("growth")
    .from("discovery_statistics")
    .select("*")
    .eq("stat_date", statDate)
    .eq("segment_key", segmentKey)
    .eq("discovery_source_type", sourceType)
    .maybeSingle()

  const existing = data as Record<string, unknown> | null
  await admin.schema("growth").from("discovery_statistics").upsert({
    stat_date: statDate,
    segment_key: segmentKey,
    discovery_source_type: sourceType,
    runs_completed: Number(existing?.runs_completed ?? 0) + 1,
    new_companies_found: Number(existing?.new_companies_found ?? 0) + stats.new_companies_found,
    duplicates_skipped: Number(existing?.duplicates_skipped ?? 0) + stats.duplicates_skipped,
    high_fit_found: Number(existing?.high_fit_found ?? 0) + stats.high_fit_found,
    territory_matches: Number(existing?.territory_matches ?? 0) + stats.territory_matches,
    signal_matches: Number(existing?.signal_matches ?? 0) + stats.signal_matches,
    updated_at: new Date().toISOString(),
  })
}

export async function runContinuousDiscoverySegment(
  admin: SupabaseClient,
  segment: GrowthDiscoverySegment,
): Promise<{ run: GrowthDiscoveryRun | null; candidates: GrowthDiscoveryCandidate[] }> {
  if (!(await isGrowthDiscoveryEngineSchemaReady(admin))) {
    return { run: null, candidates: [] }
  }

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("discovery_runs")
    .insert({
      run_type: "segment",
      segment_key: segment.key,
      discovery_source_type: segment.discovery_source_type,
      query_text: segment.query,
      industry: segment.industry,
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (runError || !runRow) return { run: null, candidates: [] }
  const runId = asString((runRow as Record<string, unknown>).id)

  const { prospectSearchFiltersToRealWorldInputs } = await import(
    "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
  )
  const { runRealWorldCompanyDiscovery } = await import(
    "@/lib/growth/real-world-discovery/real-world-discovery-repository"
  )

  const discovery = await runRealWorldCompanyDiscovery(admin, {
    query: segment.query,
    search_inputs: prospectSearchFiltersToRealWorldInputs({ industry: segment.industry }),
    limit: 40,
  })

  const existingHashes = await loadExistingDiscoveryHashes(admin)
  const candidates: GrowthDiscoveryCandidate[] = []
  let newCompanies = 0
  let duplicates = 0
  let highFit = 0

  const patternKey = buildDiscoveryPatternKey({ industry: segment.industry })
  const { data: patternRow } = await admin
    .schema("growth")
    .from("discovery_outcome_patterns")
    .select("discovery_priority_boost")
    .eq("pattern_key", patternKey)
    .maybeSingle()
  const priorityBoost = Number((patternRow as Record<string, unknown> | undefined)?.discovery_priority_boost ?? 0)

  for (const candidate of discovery.candidates) {
    const dedupe_hash = discoveryDedupeHash([
      candidate.dedupe_hash || candidate.company_name,
      candidate.domain ?? candidate.website ?? "",
    ])
    const isDuplicate = existingHashes.has(dedupe_hash)
    const isSuppressed = Boolean(candidate.metadata.suppressed)
    const adjustedConfidence = applyDiscoveryPriorityBoost(
      Math.round(candidate.confidence * 100),
      priorityBoost,
    )
    const high_fit = candidate.confidence >= HIGH_FIT_CONFIDENCE || adjustedConfidence >= 72

    if (isDuplicate) {
      duplicates += 1
      continue
    }
    if (isSuppressed) continue
    if (!candidate.evidence.length && !candidate.company_name.trim()) continue

    const reason_discovered = `Net-new ${segment.label} discovery via ${candidate.provider_name}`
    const evidence = candidate.evidence.map((entry) => ({
      claim: entry.claim,
      evidence: entry.evidence,
      source: entry.source,
    }))

    const { data: inserted } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .insert({
        run_id: runId,
        company_id: candidate.id,
        source_type: "external_discovered",
        company_name: candidate.company_name,
        website: candidate.website,
        domain: candidate.domain,
        industry: candidate.industry ?? segment.industry,
        location: candidate.location,
        city: candidate.city,
        state: candidate.state,
        discovery_source_type: segment.discovery_source_type,
        source_confidence: candidate.confidence * 100,
        evidence,
        reason_discovered,
        dedupe_hash,
        is_suppressed: false,
        is_duplicate: false,
        high_fit,
        territory_match: false,
        signal_match: false,
        discovered_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (inserted) {
      newCompanies += 1
      if (high_fit) highFit += 1
      existingHashes.add(dedupe_hash)
      const row = inserted as Record<string, unknown>
      candidates.push({
        id: asString(row.id),
        run_id: runId,
        company_id: asString(row.company_id),
        source_type: asString(row.source_type),
        company_name: asString(row.company_name),
        website: asString(row.website) || null,
        domain: asString(row.domain) || null,
        industry: asString(row.industry) || null,
        location: asString(row.location) || null,
        city: asString(row.city) || null,
        state: asString(row.state) || null,
        discovery_source_type: segment.discovery_source_type,
        source_confidence: Number(row.source_confidence ?? 0),
        evidence,
        reason_discovered,
        dedupe_hash,
        is_suppressed: false,
        is_duplicate: false,
        high_fit,
        territory_match: false,
        signal_match: false,
        discovered_at: asString(row.discovered_at),
      })
    }
  }

  const status = discovery.schema_ready && discovery.candidates.length >= 0 ? "completed" : "partial"
  const evidenceNotes = [
    {
      claim: "Provider execution",
      evidence: discovery.provider_status.message,
      source: "discovery_engine",
    },
  ]

  const { data: finished } = await admin
    .schema("growth")
    .from("discovery_runs")
    .update({
      status,
      new_companies_found: newCompanies,
      duplicates_skipped: duplicates,
      high_fit_found: highFit,
      territory_matches: 0,
      signal_matches: 0,
      evidence: evidenceNotes,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .select("*")
    .single()

  const run = finished ? rowToRun(finished as Record<string, unknown>) : null
  if (run) {
    await upsertDiscoveryStatistics(admin, segment.key, segment.discovery_source_type, run)
  }

  return { run, candidates }
}

export async function queueNightlyDiscoverySegments(admin: SupabaseClient): Promise<number> {
  let queued = 0
  for (const segment of GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS) {
    const { error } = await admin.schema("growth").from("discovery_refresh_queue").upsert(
      {
        segment_key: segment.key,
        reason: "nightly",
        status: "pending",
        scheduled_for: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "segment_key,reason" },
    )
    if (!error) queued += 1
  }
  return queued
}

export async function processDiscoveryRefreshQueue(
  admin: SupabaseClient,
  limit = 7,
): Promise<{ processed: number; failed: number; new_companies: number }> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("id, segment_key")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0
  let newCompanies = 0

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    const segmentKey = asString((row as Record<string, unknown>).segment_key)
    const segment = GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.find((entry) => entry.key === segmentKey)
    if (!queueId || !segment) continue

    await admin.schema("growth").from("discovery_refresh_queue").update({ status: "running" }).eq("id", queueId)

    try {
      const result = await runContinuousDiscoverySegment(admin, segment)
      newCompanies += result.run?.new_companies_found ?? 0
      await admin
        .schema("growth")
        .from("discovery_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("discovery_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 240) : "Discovery failed",
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return { processed, failed, newCompanies }
}

export async function listRecentDiscoveryRuns(admin: SupabaseClient, limit = 20): Promise<GrowthDiscoveryRun[]> {
  if (!(await isGrowthDiscoveryEngineSchemaReady(admin))) return []
  const { data } = await admin
    .schema("growth")
    .from("discovery_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((row) => rowToRun(row as Record<string, unknown>))
}

export function discoveryEngineSnapshotMeta() {
  return {
    qa_marker: GROWTH_DISCOVERY_ENGINE_QA_MARKER,
    privacy_note: GROWTH_DISCOVERY_ENGINE_PRIVACY_NOTE,
    segments: GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS,
  }
}

export { computeDiscoveryPriorityBoost, buildDiscoveryPatternKey }
