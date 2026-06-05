/** Phase 7.PS-IB — Resumable batch queue via discovery_refresh_queue. Server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BATCH_GRAPH_EXPANSION_MANIFEST_REASON,
  BATCH_GRAPH_EXPANSION_QUEUE_REASON,
  DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE,
  type BatchGraphExpansionCohortCompany,
  type BatchGraphExpansionCompanyStatus,
  type BatchGraphExpansionManifest,
  type BatchGraphExpansionManifestStatus,
  type BatchGraphExpansionProviderCounters,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function manifestSegmentKey(batch_id: string): string {
  return `bgx_batch:${batch_id}`
}

function companySegmentKey(batch_id: string, company_id: string): string {
  return `bgx_co:${batch_id}:${company_id}`
}

function emptyProviderCounters(): BatchGraphExpansionProviderCounters {
  return {
    website_fetches: 0,
    zerobounce_calls: 0,
    external_evidence_sources: 0,
    channel_completion_persons: 0,
  }
}

export function buildBatchGraphExpansionResumeToken(input: {
  batch_id: string
  wave_index: number
  last_company_id?: string | null
}): string {
  const tail = input.last_company_id ? `:c:${input.last_company_id}` : ""
  return `${input.batch_id}:w:${input.wave_index}${tail}`
}

export function parseBatchGraphExpansionResumeToken(
  resume_token: string,
): { batch_id: string; wave_index: number; last_company_id: string | null } | null {
  const match = resume_token.match(/^([^:]+):w:(\d+)(?::c:([0-9a-f-]+))?$/i)
  if (!match?.[1]) return null
  return {
    batch_id: match[1],
    wave_index: Number.parseInt(match[2] ?? "0", 10),
    last_company_id: match[3] ?? null,
  }
}

export function serializeBatchGraphExpansionManifest(manifest: BatchGraphExpansionManifest): string {
  return JSON.stringify(manifest)
}

export function deserializeBatchGraphExpansionManifest(
  raw: string | null | undefined,
): BatchGraphExpansionManifest | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as BatchGraphExpansionManifest
    if (!parsed?.batch_id) return null
    return parsed
  } catch {
    return null
  }
}

export async function loadBatchGraphExpansionManifest(
  admin: SupabaseClient,
  batch_id: string,
): Promise<BatchGraphExpansionManifest | null> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("last_error, status, updated_at")
    .eq("segment_key", manifestSegmentKey(batch_id))
    .eq("reason", BATCH_GRAPH_EXPANSION_MANIFEST_REASON)
    .maybeSingle()

  const manifest = deserializeBatchGraphExpansionManifest(asString(data?.last_error))
  if (!manifest) return null
  manifest.status = (asString(data?.status) as BatchGraphExpansionManifestStatus) || manifest.status
  manifest.updated_at = asString(data?.updated_at) || manifest.updated_at
  return manifest
}

export async function persistBatchGraphExpansionManifest(
  admin: SupabaseClient,
  manifest: BatchGraphExpansionManifest,
): Promise<void> {
  const nowIso = new Date().toISOString()
  manifest.updated_at = nowIso
  manifest.resume_token = buildBatchGraphExpansionResumeToken({
    batch_id: manifest.batch_id,
    wave_index: manifest.wave_index,
    last_company_id: manifest.last_company_id,
  })

  await admin.schema("growth").from("discovery_refresh_queue").upsert(
    {
      segment_key: manifestSegmentKey(manifest.batch_id),
      reason: BATCH_GRAPH_EXPANSION_MANIFEST_REASON,
      status: manifest.stopped ? "failed" : manifest.status === "completed" ? "completed" : "running",
      scheduled_for: nowIso,
      last_error: serializeBatchGraphExpansionManifest(manifest),
      updated_at: nowIso,
    },
    { onConflict: "segment_key,reason" },
  )
}

export async function enqueueBatchGraphExpansionCompanies(
  admin: SupabaseClient,
  input: {
    batch_id: string
    companies: BatchGraphExpansionCohortCompany[]
  },
): Promise<number> {
  let queued = 0
  const nowIso = new Date().toISOString()
  for (const company of input.companies) {
    const { error } = await admin.schema("growth").from("discovery_refresh_queue").upsert(
      {
        segment_key: companySegmentKey(input.batch_id, company.canonical_company_id),
        reason: BATCH_GRAPH_EXPANSION_QUEUE_REASON,
        status: "pending",
        scheduled_for: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "segment_key,reason" },
    )
    if (!error) queued += 1
  }
  return queued
}

export async function loadPendingBatchGraphExpansionCompanies(
  admin: SupabaseClient,
  input: { batch_id: string; limit?: number },
): Promise<Array<{ queue_id: string; canonical_company_id: string; status: BatchGraphExpansionCompanyStatus }>> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .select("id, segment_key, status, last_error")
    .eq("reason", BATCH_GRAPH_EXPANSION_QUEUE_REASON)
    .like("segment_key", `bgx_co:${input.batch_id}:%`)
    .in("status", ["pending", "failed"])
    .order("scheduled_for", { ascending: true })
    .limit(input.limit ?? DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE)

  const rows: Array<{
    queue_id: string
    canonical_company_id: string
    status: BatchGraphExpansionCompanyStatus
  }> = []

  for (const row of data ?? []) {
    const segment = asString(row.segment_key)
    const company_id = segment.split(":").pop() ?? ""
    if (!company_id) continue
    rows.push({
      queue_id: asString(row.id),
      canonical_company_id: company_id,
      status: (asString(row.status) as BatchGraphExpansionCompanyStatus) || "pending",
    })
  }
  return rows
}

export async function updateBatchGraphExpansionCompanyQueue(
  admin: SupabaseClient,
  input: {
    queue_id: string
    status: BatchGraphExpansionCompanyStatus
    failure_reason?: string | null
  },
): Promise<void> {
  const queueStatus =
    input.status === "completed"
      ? "completed"
      : input.status === "failed" || input.status === "stopped"
        ? "failed"
        : input.status === "running"
          ? "running"
          : "pending"

  await admin
    .schema("growth")
    .from("discovery_refresh_queue")
    .update({
      status: queueStatus,
      last_error: input.failure_reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.queue_id)
}

export function createInitialBatchGraphExpansionManifest(input: {
  batch_id?: string
  wave_size?: number
  companies_total: number
}): BatchGraphExpansionManifest {
  const batch_id = input.batch_id ?? randomUUID()
  const wave_size = input.wave_size ?? DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE
  const started_at = new Date().toISOString()
  return {
    batch_id,
    resume_token: buildBatchGraphExpansionResumeToken({ batch_id, wave_index: 0 }),
    status: "pending",
    wave_size,
    wave_index: 0,
    companies_total: input.companies_total,
    companies_queued: 0,
    companies_completed: 0,
    companies_failed: 0,
    companies_skipped: 0,
    last_company_id: null,
    failure_reasons: [],
    provider_counters: emptyProviderCounters(),
    started_at,
    updated_at: started_at,
    stopped: false,
  }
}
