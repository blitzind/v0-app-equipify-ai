import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeRetentionCutoff,
  GROWTH_EVENT_RETENTION_TABLE_MAP,
  type GrowthEventRetentionFamily,
  type GrowthEventRetentionPolicy,
} from "@/lib/growth/runtime-guardrails/growth-event-retention-config"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

function retentionConfigTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_event_retention_config")
}

function retentionBatchTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_retention_batch_state")
}

export async function listEventRetentionPolicies(
  admin: SupabaseClient,
): Promise<GrowthEventRetentionPolicy[]> {
  const { data, error } = await retentionConfigTable(admin).select("*").order("event_family")
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    eventFamily: String((row as { event_family: string }).event_family) as GrowthEventRetentionFamily,
    retentionDays: Number((row as { retention_days: number }).retention_days),
    rollupRetentionDays: Number((row as { rollup_retention_days: number }).rollup_retention_days),
    enabled: Boolean((row as { enabled: boolean }).enabled),
  }))
}

export type RetentionBatchResult = {
  eventFamily: GrowthEventRetentionFamily
  deletedCount: number
  hasMore: boolean
  cutoff: string
}

export async function runEventRetentionBatch(
  admin: SupabaseClient,
  input: { eventFamily: GrowthEventRetentionFamily },
): Promise<RetentionBatchResult> {
  const startedMs = Date.now()
  const enabled = await isRuntimeKillSwitchEnabled(admin, "retention_worker_enabled")
  if (!enabled) {
    return {
      eventFamily: input.eventFamily,
      deletedCount: 0,
      hasMore: false,
      cutoff: new Date().toISOString(),
    }
  }

  const { data: policyRow, error: policyError } = await retentionConfigTable(admin)
    .select("*")
    .eq("event_family", input.eventFamily)
    .maybeSingle()

  if (policyError) throw new Error(policyError.message)
  if (!policyRow || !(policyRow as { enabled: boolean }).enabled) {
    return {
      eventFamily: input.eventFamily,
      deletedCount: 0,
      hasMore: false,
      cutoff: new Date().toISOString(),
    }
  }

  const retentionDays = Number((policyRow as { retention_days: number }).retention_days)
  const cutoff = computeRetentionCutoff(retentionDays)
  const mapping = GROWTH_EVENT_RETENTION_TABLE_MAP[input.eventFamily]
  const batchSize = GROWTH_RUNTIME_GUARDRAIL_LIMITS.RETENTION_DELETE_BATCH

  const { data: staleRows, error: selectError } = await admin
    .schema("growth")
    .from(mapping.table)
    .select("id")
    .lt(mapping.timestampColumn, cutoff)
    .order(mapping.timestampColumn, { ascending: true })
    .limit(batchSize)

  if (selectError) throw new Error(selectError.message)

  const ids = (staleRows ?? []).map((row) => String((row as { id: string }).id))
  if (ids.length === 0) {
    const durationMs = Date.now() - startedMs
    await retentionBatchTable(admin).upsert(
      {
        event_family: input.eventFamily,
        last_run_at: new Date().toISOString(),
        last_duration_ms: durationMs,
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_family" },
    )
    return { eventFamily: input.eventFamily, deletedCount: 0, hasMore: false, cutoff }
  }

  const { error: deleteError } = await admin
    .schema("growth")
    .from(mapping.table)
    .delete()
    .in("id", ids)

  if (deleteError) throw new Error(deleteError.message)

  const { data: batchState } = await retentionBatchTable(admin)
    .select("deleted_count")
    .eq("event_family", input.eventFamily)
    .maybeSingle()

  const priorDeleted = Number((batchState as { deleted_count?: number } | null)?.deleted_count ?? 0)
  const durationMs = Date.now() - startedMs

  await retentionBatchTable(admin).upsert(
    {
      event_family: input.eventFamily,
      last_deleted_id: ids.at(-1) ?? null,
      deleted_count: priorDeleted + ids.length,
      last_run_at: new Date().toISOString(),
      last_duration_ms: durationMs,
      qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_family" },
  )

  return {
    eventFamily: input.eventFamily,
    deletedCount: ids.length,
    hasMore: ids.length === batchSize,
    cutoff,
  }
}

export async function runAllEventRetentionBatches(
  admin: SupabaseClient,
): Promise<RetentionBatchResult[]> {
  const families = Object.keys(GROWTH_EVENT_RETENTION_TABLE_MAP) as GrowthEventRetentionFamily[]
  const results: RetentionBatchResult[] = []
  for (const eventFamily of families) {
    results.push(await runEventRetentionBatch(admin, { eventFamily }))
  }
  return results
}
