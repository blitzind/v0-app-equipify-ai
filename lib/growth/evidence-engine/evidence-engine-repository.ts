/** GE-AIOS-8A-2 — Evidence Engine persistence repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  AvaContradiction,
  AvaEvidenceItem,
  AvaFact,
  EvidenceEngineProvider,
  EvidenceEngineRunStatus,
  EvidenceEngineTrigger,
} from "@/lib/growth/evidence-engine/evidence-engine-types"
import {
  buildEvidenceEngineSnapshotPayload,
  type EvidenceEngineSnapshotPayload,
  type EvidenceEngineSnapshotRecord,
} from "@/lib/growth/evidence-engine/evidence-engine-snapshot"

const RUNS_TABLE = "evidence_engine_runs"
const EVIDENCE_TABLE = "evidence_engine_evidence"
const FACTS_TABLE = "evidence_engine_facts"
const CONTRADICTIONS_TABLE = "evidence_engine_contradictions"
const SNAPSHOTS_TABLE = "evidence_engine_snapshots"

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(RUNS_TABLE)
}

function evidenceTable(admin: SupabaseClient) {
  return admin.schema("growth").from(EVIDENCE_TABLE)
}

function factsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(FACTS_TABLE)
}

function contradictionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(CONTRADICTIONS_TABLE)
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from(SNAPSHOTS_TABLE)
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "42P01" || /evidence_engine_/i.test(error.message ?? "")
}

export async function isEvidenceEngineSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await runsTable(admin).select("id").limit(1)
  return !error
}

export async function createEvidenceEngineRun(
  admin: SupabaseClient,
  input: {
    organization_id: string
    trigger: EvidenceEngineTrigger
    input_hash: string
    extraction_version: string
    website_url?: string | null
    providers: EvidenceEngineProvider[]
    metadata?: Record<string, unknown>
  },
): Promise<string> {
  const startedAt = new Date().toISOString()
  const { data, error } = await runsTable(admin)
    .insert({
      organization_id: input.organization_id,
      trigger: input.trigger,
      status: "running",
      input_hash: input.input_hash,
      extraction_version: input.extraction_version,
      website_url: input.website_url ?? null,
      providers: input.providers,
      started_at: startedAt,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()

  if (error) throw new Error(`createEvidenceEngineRun: ${error.message}`)
  return data.id as string
}

export async function persistEvidenceEngineEvidence(
  admin: SupabaseClient,
  input: {
    run_id: string
    organization_id: string
    evidence: AvaEvidenceItem[]
  },
): Promise<number> {
  if (input.evidence.length === 0) return 0

  const rows = input.evidence.map((item) => ({
    run_id: input.run_id,
    organization_id: input.organization_id,
    evidence_id: item.evidence_id,
    provider: item.provider,
    decision_tier: item.decision_tier,
    lifecycle_status: item.lifecycle_status,
    evidence_type: item.evidence_type,
    value_text: item.value_text,
    value_json: item.value_json,
    source_url: item.source_url,
    page_title: item.page_title,
    raw_excerpt: item.raw_excerpt,
    confidence: item.confidence,
    extracted_at: item.extracted_at,
    verified_at: item.verified_at,
    expires_at: item.expires_at,
    source_lineage: {
      provider: item.provider,
      decision_tier: item.decision_tier,
      evidence_type: item.evidence_type,
      source_url: item.source_url,
      ...(item.metadata ?? {}),
    },
    metadata: item.metadata ?? {},
  }))

  const { error } = await evidenceTable(admin).insert(rows)
  if (error) throw new Error(`persistEvidenceEngineEvidence: ${error.message}`)
  return rows.length
}

export async function persistEvidenceEngineFacts(
  admin: SupabaseClient,
  input: {
    run_id: string
    organization_id: string
    facts: AvaFact[]
  },
): Promise<number> {
  if (input.facts.length === 0) return 0

  const rows = input.facts.map((fact) => ({
    run_id: input.run_id,
    organization_id: input.organization_id,
    fact_id: fact.fact_id,
    fact_key: fact.fact_key,
    category: fact.category,
    value_text: fact.value_text,
    value_json: fact.value_json,
    lifecycle_status: fact.lifecycle_status,
    confidence: fact.confidence,
    supporting_evidence_ids: fact.supporting_evidence_ids,
    contradicting_evidence_ids: fact.contradicting_evidence_ids,
    first_seen_at: fact.first_seen_at,
    last_seen_at: fact.last_seen_at,
    last_verified_at: fact.last_verified_at,
    deprecated_at: fact.deprecated_at,
    metadata: fact.metadata ?? {},
  }))

  const { error } = await factsTable(admin).insert(rows)
  if (error) throw new Error(`persistEvidenceEngineFacts: ${error.message}`)
  return rows.length
}

export async function persistEvidenceEngineContradictions(
  admin: SupabaseClient,
  input: {
    run_id: string
    organization_id: string
    contradictions: AvaContradiction[]
  },
): Promise<number> {
  if (input.contradictions.length === 0) return 0

  const rows = input.contradictions.map((item) => ({
    run_id: input.run_id,
    organization_id: input.organization_id,
    contradiction_id: item.contradiction_id,
    fact_key: item.fact_key,
    conflicting_values: item.conflicting_values,
    evidence_ids: item.evidence_ids,
    severity: item.severity,
    recommended_resolution: item.recommended_resolution,
    requires_human_review: item.requires_human_review,
    metadata: {},
  }))

  const { error } = await contradictionsTable(admin).insert(rows)
  if (error) throw new Error(`persistEvidenceEngineContradictions: ${error.message}`)
  return rows.length
}

export async function persistEvidenceEngineSnapshot(
  admin: SupabaseClient,
  input: {
    organization_id: string
    run_id: string
    input_hash: string
    source_providers: EvidenceEngineProvider[]
    evidence: AvaEvidenceItem[]
    facts: AvaFact[]
    contradictions: AvaContradiction[]
    metadata?: Record<string, unknown>
  },
): Promise<string> {
  const generatedAt = new Date().toISOString()
  const snapshot = buildEvidenceEngineSnapshotPayload({
    organization_id: input.organization_id,
    run_id: input.run_id,
    generated_at: generatedAt,
    source_providers: input.source_providers,
    evidence: input.evidence,
    facts: input.facts,
    contradictions: input.contradictions,
    metadata: input.metadata,
  })

  const { error: clearError } = await snapshotsTable(admin)
    .update({ is_current: false })
    .eq("organization_id", input.organization_id)
    .eq("is_current", true)
  if (clearError && !isMissingTableError(clearError)) {
    throw new Error(`persistEvidenceEngineSnapshot(clear current): ${clearError.message}`)
  }

  const { data, error } = await snapshotsTable(admin)
    .insert({
      organization_id: input.organization_id,
      run_id: input.run_id,
      generated_at: generatedAt,
      input_hash: input.input_hash,
      is_current: true,
      source_providers: input.source_providers,
      snapshot_json: snapshot,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()

  if (error) throw new Error(`persistEvidenceEngineSnapshot: ${error.message}`)
  return data.id as string
}

export async function finalizeEvidenceEngineRun(
  admin: SupabaseClient,
  input: {
    run_id: string
    status: EvidenceEngineRunStatus
    evidence_count: number
    fact_count: number
    contradiction_count: number
    warnings?: string[]
    diagnostics?: Record<string, unknown>
    error_message?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await runsTable(admin)
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      evidence_count: input.evidence_count,
      fact_count: input.fact_count,
      contradiction_count: input.contradiction_count,
      warnings: input.warnings ?? [],
      diagnostics: input.diagnostics ?? {},
      error_message: input.error_message ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", input.run_id)

  if (error) throw new Error(`finalizeEvidenceEngineRun: ${error.message}`)
}

export type EvidenceEngineRunRecord = {
  run_id: string
  organization_id: string
  trigger: EvidenceEngineTrigger
  status: EvidenceEngineRunStatus
  input_hash: string
  extraction_version: string
  website_url: string | null
  providers: EvidenceEngineProvider[]
  started_at: string | null
  completed_at: string | null
  evidence_count: number
  fact_count: number
  contradiction_count: number
  warnings: string[]
  diagnostics: Record<string, unknown>
  metadata: Record<string, unknown>
}

export async function fetchLatestSuccessfulEvidenceEngineRun(
  admin: SupabaseClient,
  organizationId: string,
): Promise<EvidenceEngineRunRecord | null> {
  const { data, error } = await runsTable(admin)
    .select(
      "id, organization_id, trigger, status, input_hash, extraction_version, website_url, providers, started_at, completed_at, evidence_count, fact_count, contradiction_count, warnings, diagnostics, metadata",
    )
    .eq("organization_id", organizationId)
    .in("status", ["completed", "cached"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(`fetchLatestSuccessfulEvidenceEngineRun: ${error.message}`)
  }
  if (!data) return null

  return {
    run_id: data.id as string,
    organization_id: data.organization_id as string,
    trigger: data.trigger as EvidenceEngineTrigger,
    status: data.status as EvidenceEngineRunStatus,
    input_hash: typeof data.input_hash === "string" ? data.input_hash : "",
    extraction_version: typeof data.extraction_version === "string" ? data.extraction_version : "",
    website_url: typeof data.website_url === "string" ? data.website_url : null,
    providers: Array.isArray(data.providers) ? (data.providers as EvidenceEngineProvider[]) : [],
    started_at: typeof data.started_at === "string" ? data.started_at : null,
    completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
    evidence_count: Number(data.evidence_count) || 0,
    fact_count: Number(data.fact_count) || 0,
    contradiction_count: Number(data.contradiction_count) || 0,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
    diagnostics:
      data.diagnostics && typeof data.diagnostics === "object"
        ? (data.diagnostics as Record<string, unknown>)
        : {},
    metadata: data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {},
  }
}

export async function fetchCachedEvidenceEngineRunByInputHash(
  admin: SupabaseClient,
  input: {
    organization_id: string
    input_hash: string
  },
): Promise<EvidenceEngineRunRecord | null> {
  const { data, error } = await runsTable(admin)
    .select(
      "id, organization_id, trigger, status, input_hash, extraction_version, website_url, providers, started_at, completed_at, evidence_count, fact_count, contradiction_count, warnings, diagnostics, metadata",
    )
    .eq("organization_id", input.organization_id)
    .eq("input_hash", input.input_hash)
    .in("status", ["completed", "cached"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(`fetchCachedEvidenceEngineRunByInputHash: ${error.message}`)
  }
  if (!data) return null

  return {
    run_id: data.id as string,
    organization_id: data.organization_id as string,
    trigger: data.trigger as EvidenceEngineTrigger,
    status: data.status as EvidenceEngineRunStatus,
    input_hash: typeof data.input_hash === "string" ? data.input_hash : "",
    extraction_version: typeof data.extraction_version === "string" ? data.extraction_version : "",
    website_url: typeof data.website_url === "string" ? data.website_url : null,
    providers: Array.isArray(data.providers) ? (data.providers as EvidenceEngineProvider[]) : [],
    started_at: typeof data.started_at === "string" ? data.started_at : null,
    completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
    evidence_count: Number(data.evidence_count) || 0,
    fact_count: Number(data.fact_count) || 0,
    contradiction_count: Number(data.contradiction_count) || 0,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
    diagnostics:
      data.diagnostics && typeof data.diagnostics === "object"
        ? (data.diagnostics as Record<string, unknown>)
        : {},
    metadata: data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {},
  }
}

export async function fetchLatestEvidenceEngineSnapshot(
  admin: SupabaseClient,
  organizationId: string,
): Promise<EvidenceEngineSnapshotRecord | null> {
  const { data, error } = await snapshotsTable(admin)
    .select("id, organization_id, run_id, generated_at, input_hash, is_current, snapshot_json")
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(`fetchLatestEvidenceEngineSnapshot: ${error.message}`)
  }
  if (!data) return null

  const snapshot =
    data.snapshot_json && typeof data.snapshot_json === "object"
      ? (data.snapshot_json as EvidenceEngineSnapshotPayload)
      : null
  if (!snapshot) return null

  return {
    snapshot_id: data.id as string,
    organization_id: data.organization_id as string,
    run_id: data.run_id as string,
    generated_at: typeof data.generated_at === "string" ? data.generated_at : snapshot.generated_at,
    input_hash: typeof data.input_hash === "string" ? data.input_hash : "",
    is_current: Boolean(data.is_current),
    snapshot,
  }
}

export async function fetchEvidenceEngineEvidenceByFactKey(
  admin: SupabaseClient,
  input: {
    organization_id: string
    fact_key: string
    run_id?: string | null
    limit?: number
  },
): Promise<AvaEvidenceItem[]> {
  let factQuery = factsTable(admin)
    .select("fact_id, supporting_evidence_ids, run_id")
    .eq("organization_id", input.organization_id)
    .eq("fact_key", input.fact_key)
    .order("last_seen_at", { ascending: false })
    .limit(input.limit ?? 20)

  if (input.run_id) {
    factQuery = factQuery.eq("run_id", input.run_id)
  }

  const { data: factRows, error: factError } = await factQuery
  if (factError) {
    if (isMissingTableError(factError)) return []
    throw new Error(`fetchEvidenceEngineEvidenceByFactKey(facts): ${factError.message}`)
  }

  const evidenceIds = [
    ...new Set(
      (factRows ?? []).flatMap((row) =>
        Array.isArray(row.supporting_evidence_ids) ? (row.supporting_evidence_ids as string[]) : [],
      ),
    ),
  ]
  if (evidenceIds.length === 0) return []

  let evidenceQuery = evidenceTable(admin)
    .select(
      "evidence_id, organization_id, provider, decision_tier, lifecycle_status, evidence_type, value_text, value_json, source_url, page_title, raw_excerpt, confidence, extracted_at, verified_at, expires_at, metadata",
    )
    .eq("organization_id", input.organization_id)
    .in("evidence_id", evidenceIds)

  if (input.run_id) {
    evidenceQuery = evidenceQuery.eq("run_id", input.run_id)
  }

  const { data: evidenceRows, error: evidenceError } = await evidenceQuery
  if (evidenceError) {
    if (isMissingTableError(evidenceError)) return []
    throw new Error(`fetchEvidenceEngineEvidenceByFactKey(evidence): ${evidenceError.message}`)
  }

  return (evidenceRows ?? []).map((row) => ({
    evidence_id: row.evidence_id as string,
    organization_id: row.organization_id as string,
    provider: row.provider as AvaEvidenceItem["provider"],
    decision_tier: row.decision_tier as AvaEvidenceItem["decision_tier"],
    lifecycle_status: row.lifecycle_status as AvaEvidenceItem["lifecycle_status"],
    evidence_type: row.evidence_type as AvaEvidenceItem["evidence_type"],
    value_text: typeof row.value_text === "string" ? row.value_text : null,
    value_json:
      row.value_json && typeof row.value_json === "object"
        ? (row.value_json as Record<string, unknown>)
        : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    page_title: typeof row.page_title === "string" ? row.page_title : null,
    raw_excerpt: typeof row.raw_excerpt === "string" ? row.raw_excerpt : null,
    confidence:
      row.confidence && typeof row.confidence === "object"
        ? (row.confidence as AvaEvidenceItem["confidence"])
        : {
            evidence_confidence: 0,
            extraction_confidence: 0,
            verification_confidence: 0,
            freshness_confidence: 0,
            overall_confidence: 0,
          },
    extracted_at: typeof row.extracted_at === "string" ? row.extracted_at : new Date().toISOString(),
    verified_at: typeof row.verified_at === "string" ? row.verified_at : null,
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }))
}

export async function fetchEvidenceEngineEvidenceByIds(
  admin: SupabaseClient,
  input: {
    organization_id: string
    evidence_ids: string[]
    run_id?: string | null
  },
): Promise<AvaEvidenceItem[]> {
  const evidenceIds = [...new Set(input.evidence_ids.filter(Boolean))]
  if (evidenceIds.length === 0) return []

  let evidenceQuery = evidenceTable(admin)
    .select(
      "evidence_id, organization_id, provider, decision_tier, lifecycle_status, evidence_type, value_text, value_json, source_url, page_title, raw_excerpt, confidence, extracted_at, verified_at, expires_at, metadata",
    )
    .eq("organization_id", input.organization_id)
    .in("evidence_id", evidenceIds)

  if (input.run_id) {
    evidenceQuery = evidenceQuery.eq("run_id", input.run_id)
  }

  const { data: evidenceRows, error: evidenceError } = await evidenceQuery
  if (evidenceError) {
    if (isMissingTableError(evidenceError)) return []
    throw new Error(`fetchEvidenceEngineEvidenceByIds: ${evidenceError.message}`)
  }

  return (evidenceRows ?? []).map((row) => ({
    evidence_id: row.evidence_id as string,
    organization_id: row.organization_id as string,
    provider: row.provider as AvaEvidenceItem["provider"],
    decision_tier: row.decision_tier as AvaEvidenceItem["decision_tier"],
    lifecycle_status: row.lifecycle_status as AvaEvidenceItem["lifecycle_status"],
    evidence_type: row.evidence_type as AvaEvidenceItem["evidence_type"],
    value_text: typeof row.value_text === "string" ? row.value_text : null,
    value_json:
      row.value_json && typeof row.value_json === "object"
        ? (row.value_json as Record<string, unknown>)
        : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    page_title: typeof row.page_title === "string" ? row.page_title : null,
    raw_excerpt: typeof row.raw_excerpt === "string" ? row.raw_excerpt : null,
    confidence:
      row.confidence && typeof row.confidence === "object"
        ? (row.confidence as AvaEvidenceItem["confidence"])
        : {
            evidence_confidence: 0,
            extraction_confidence: 0,
            verification_confidence: 0,
            freshness_confidence: 0,
            overall_confidence: 0,
          },
    extracted_at: typeof row.extracted_at === "string" ? row.extracted_at : new Date().toISOString(),
    verified_at: typeof row.verified_at === "string" ? row.verified_at : null,
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }))
}

export async function persistEvidenceEngineRunBundle(
  admin: SupabaseClient,
  input: {
    organization_id: string
    trigger: EvidenceEngineTrigger
    input_hash: string
    extraction_version: string
    website_url?: string | null
    providers: EvidenceEngineProvider[]
    evidence: AvaEvidenceItem[]
    facts: AvaFact[]
    contradictions: AvaContradiction[]
    warnings: string[]
    diagnostics: Record<string, unknown>
    metadata?: Record<string, unknown>
  },
): Promise<{ run_id: string; snapshot_id: string }> {
  const runId = await createEvidenceEngineRun(admin, {
    organization_id: input.organization_id,
    trigger: input.trigger,
    input_hash: input.input_hash,
    extraction_version: input.extraction_version,
    website_url: input.website_url,
    providers: input.providers,
    metadata: input.metadata,
  })

  const evidenceCount = await persistEvidenceEngineEvidence(admin, {
    run_id: runId,
    organization_id: input.organization_id,
    evidence: input.evidence,
  })
  const factCount = await persistEvidenceEngineFacts(admin, {
    run_id: runId,
    organization_id: input.organization_id,
    facts: input.facts,
  })
  const contradictionCount = await persistEvidenceEngineContradictions(admin, {
    run_id: runId,
    organization_id: input.organization_id,
    contradictions: input.contradictions,
  })

  const snapshotId = await persistEvidenceEngineSnapshot(admin, {
    organization_id: input.organization_id,
    run_id: runId,
    input_hash: input.input_hash,
    source_providers: input.providers,
    evidence: input.evidence,
    facts: input.facts,
    contradictions: input.contradictions,
    metadata: input.metadata,
  })

  const status: EvidenceEngineRunStatus =
    evidenceCount === 0 && factCount === 0 ? "partial" : "completed"

  await finalizeEvidenceEngineRun(admin, {
    run_id: runId,
    status,
    evidence_count: evidenceCount,
    fact_count: factCount,
    contradiction_count: contradictionCount,
    warnings: input.warnings,
    diagnostics: input.diagnostics,
    metadata: {
      ...(input.metadata ?? {}),
      snapshot_id: snapshotId,
    },
  })

  return { run_id: runId, snapshot_id: snapshotId }
}

export function snapshotRecordToRunResult(input: {
  snapshot: EvidenceEngineSnapshotRecord
  run: EvidenceEngineRunRecord
  trigger: EvidenceEngineTrigger
  warnings?: string[]
}): {
  collections: never[]
  evidence: AvaEvidenceItem[]
  facts: AvaFact[]
  contradictions: AvaContradiction[]
  warnings: string[]
  diagnostics: Record<string, unknown>
  run_id: string
  snapshot_id: string
  input_hash: string
  cached: true
  persisted: true
} {
  return {
    collections: [],
    evidence: input.snapshot.snapshot.evidence ?? [],
    facts: input.snapshot.snapshot.facts,
    contradictions: input.snapshot.snapshot.contradictions,
    warnings: input.warnings ?? input.run.warnings,
    diagnostics: {
      ...input.run.diagnostics,
      cache_hit: true,
      cached_run_id: input.run.run_id,
      cached_snapshot_id: input.snapshot.snapshot_id,
    },
    run_id: input.run.run_id,
    snapshot_id: input.snapshot.snapshot_id,
    input_hash: input.run.input_hash,
    cached: true,
    persisted: true,
  }
}
