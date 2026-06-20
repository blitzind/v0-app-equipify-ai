import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeRetentionCutoff,
  GROWTH_EVENT_RETENTION_TABLE_MAP,
  type GrowthEventRetentionFamily,
} from "@/lib/growth/runtime-guardrails/growth-event-retention-config"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

export type RetentionBacklogSnapshot = {
  retentionRowsPending: number
  retentionBatchesRemaining: number
  lastRetentionRunAt: string | null
  lastRetentionDurationMs: number | null
  lastRetentionDeletedRows: number
  families: Array<{
    eventFamily: GrowthEventRetentionFamily
    rowsPending: number
    batchesRemaining: number
    lastRunAt: string | null
    lastDurationMs: number | null
  }>
}

const EMPTY_BACKLOG: RetentionBacklogSnapshot = {
  retentionRowsPending: 0,
  retentionBatchesRemaining: 0,
  lastRetentionRunAt: null,
  lastRetentionDurationMs: null,
  lastRetentionDeletedRows: 0,
  families: [],
}

export async function getRetentionBacklogSnapshot(
  admin: SupabaseClient,
): Promise<RetentionBacklogSnapshot> {
  const batchProbe = await probeRuntimeTable(admin, "runtime_retention_batch_state")
  if (batchProbe.missing) return EMPTY_BACKLOG

  const configProbe = await probeRuntimeTable(admin, "growth_event_retention_config")
  if (configProbe.missing) return EMPTY_BACKLOG

  const { data: policies, error: policyError } = await admin
    .schema("growth")
    .from("growth_event_retention_config")
    .select("event_family, retention_days, enabled")
    .eq("enabled", true)
    .limit(10)

  if (policyError) return EMPTY_BACKLOG

  const { data: batchStates, error: batchError } = await admin
    .schema("growth")
    .from("runtime_retention_batch_state")
    .select("event_family, last_run_at, last_duration_ms, deleted_count")
    .limit(10)

  if (batchError) return EMPTY_BACKLOG

  const batchByFamily = new Map(
    (batchStates ?? []).map((row) => [
      String((row as { event_family: string }).event_family),
      row as { last_run_at: string | null; last_duration_ms: number | null; deleted_count: number },
    ]),
  )

  const batchSize = GROWTH_RUNTIME_GUARDRAIL_LIMITS.RETENTION_DELETE_BATCH
  let retentionRowsPending = 0
  let retentionBatchesRemaining = 0
  let lastRetentionRunAt: string | null = null
  let lastRetentionDurationMs: number | null = null
  let lastRetentionDeletedRows = 0
  const families: RetentionBacklogSnapshot["families"] = []

  for (const policy of policies ?? []) {
    const eventFamily = String((policy as { event_family: string }).event_family) as GrowthEventRetentionFamily
    const retentionDays = Number((policy as { retention_days: number }).retention_days)
    const mapping = GROWTH_EVENT_RETENTION_TABLE_MAP[eventFamily]
    if (!mapping) continue

    const tableProbe = await probeRuntimeTable(admin, mapping.table)
    if (tableProbe.missing) {
      families.push({
        eventFamily,
        rowsPending: 0,
        batchesRemaining: 0,
        lastRunAt: null,
        lastDurationMs: null,
      })
      continue
    }

    const cutoff = computeRetentionCutoff(retentionDays)
    const { count, error } = await admin
      .schema("growth")
      .from(mapping.table)
      .select("id", { count: "exact", head: true })
      .lt(mapping.timestampColumn, cutoff)

    const rowsPending = error ? 0 : (count ?? 0)
    const batchesRemaining = rowsPending > 0 ? Math.ceil(rowsPending / batchSize) : 0
    retentionRowsPending += rowsPending
    retentionBatchesRemaining += batchesRemaining

    const batch = batchByFamily.get(eventFamily)
    const lastRunAt = batch?.last_run_at ?? null
    const lastDurationMs = batch?.last_duration_ms ?? null
    if (lastRunAt && (!lastRetentionRunAt || lastRunAt > lastRetentionRunAt)) {
      lastRetentionRunAt = lastRunAt
      lastRetentionDurationMs = lastDurationMs
      lastRetentionDeletedRows = Number(batch?.deleted_count ?? 0)
    }

    families.push({ eventFamily, rowsPending, batchesRemaining, lastRunAt, lastDurationMs })
  }

  return {
    retentionRowsPending,
    retentionBatchesRemaining,
    lastRetentionRunAt,
    lastRetentionDurationMs,
    lastRetentionDeletedRows,
    families,
  }
}
