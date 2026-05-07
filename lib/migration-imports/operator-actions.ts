import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordOperatorEvent } from "./operator-events"

/**
 * Phase 4: bulk operator actions for failed/stuck async import runs.
 *
 * These helpers do NOT touch the runner mutex/lease semantics directly — they
 * only adjust queue eligibility (`status`, `next_retry_at`, `lease_*`) so that
 * the existing cron processor (`processNextRunnableImportRun`) and stale-lease
 * sweeper (`recoverStaleLeases`) pick the runs back up safely.
 *
 * All writes use the service role; callers must already be platform admins.
 */

const STALE_LEASE_GRACE_SECONDS = 120
const MAX_BULK_BATCH = 50

export type BulkActorContext = {
  actorUserId?: string | null
  actorEmail?: string | null
  actorKind?: "platform_admin" | "operator" | "system"
}

export type BulkActionResult = {
  attempted: number
  succeeded: number
  skipped: number
  errors: Array<{ runId: string; message: string }>
  affectedRuns: Array<{
    runId: string
    importJobId: string
    organizationId: string
    previousStatus: string
    nextStatus: string
  }>
}

function emptyResult(attempted = 0): BulkActionResult {
  return { attempted, succeeded: 0, skipped: 0, errors: [], affectedRuns: [] }
}

async function loadRuns(
  svc: SupabaseClient,
  runIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (runIds.length === 0) return []
  const { data } = await svc
    .from("organization_import_job_runs")
    .select(
      "id, status, organization_id, import_job_id, retry_count, max_retries, recovery_json, lease_expires_at, last_heartbeat_at, resume_cursor, current_chunk_index",
    )
    .in("id", runIds.slice(0, MAX_BULK_BATCH))
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function bulkRetryFailedRuns(
  svc: SupabaseClient,
  runIds: string[],
  actor: BulkActorContext,
): Promise<BulkActionResult> {
  const ids = [...new Set(runIds.map((s) => String(s ?? "").trim()))].filter(Boolean).slice(0, MAX_BULK_BATCH)
  const result = emptyResult(ids.length)
  if (ids.length === 0) return result

  const rows = await loadRuns(svc, ids)
  const nowIso = new Date().toISOString()

  for (const row of rows) {
    const runId = String(row.id ?? "")
    const status = String(row.status ?? "")
    const organizationId = String(row.organization_id ?? "")
    const importJobId = String(row.import_job_id ?? "")
    if (status !== "failed") {
      result.skipped += 1
      result.errors.push({ runId, message: `Run is not in failed state (status=${status}).` })
      continue
    }

    const prevRecovery = (row.recovery_json as Record<string, unknown> | null) ?? {}
    const { error } = await svc
      .from("organization_import_job_runs")
      .update({
        status: "queued",
        completed_at: null,
        next_retry_at: null,
        lease_owner: null,
        lease_expires_at: null,
        last_heartbeat_at: nowIso,
        error_message: null,
        recovery_json: {
          ...prevRecovery,
          bulk_retry_at: nowIso,
          bulk_retry_actor_kind: actor.actorKind ?? "platform_admin",
          resume_cursor: row.resume_cursor ?? 0,
        },
      })
      .eq("id", runId)
      .eq("status", "failed")

    if (error) {
      result.errors.push({ runId, message: error.message })
      continue
    }

    await svc
      .from("organization_import_jobs")
      .update({
        status: "queued",
        active_run_id: runId,
        completed_at: null,
        user_message: "Background import re-queued by platform admin bulk retry.",
      })
      .eq("id", importJobId)
      .eq("organization_id", organizationId)

    await recordOperatorEvent({
      importJobId,
      importRunId: runId,
      organizationId,
      actorUserId: actor.actorUserId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorKind: actor.actorKind ?? "platform_admin",
      eventType: "bulk_retry",
      severity: "info",
      message: "Bulk retry: failed run re-queued from import operations panel.",
      metadata: {
        previousStatus: status,
        cursor: row.resume_cursor ?? 0,
      },
    })

    result.succeeded += 1
    result.affectedRuns.push({
      runId,
      importJobId,
      organizationId,
      previousStatus: status,
      nextStatus: "queued",
    })
  }

  return result
}

export async function bulkRecoverStaleRuns(
  svc: SupabaseClient,
  runIds: string[],
  actor: BulkActorContext,
): Promise<BulkActionResult> {
  const ids = [...new Set(runIds.map((s) => String(s ?? "").trim()))].filter(Boolean).slice(0, MAX_BULK_BATCH)
  const result = emptyResult(ids.length)
  if (ids.length === 0) return result

  const rows = await loadRuns(svc, ids)
  const nowIso = new Date().toISOString()
  const staleCutoff = new Date(Date.now() - STALE_LEASE_GRACE_SECONDS * 1000).toISOString()

  for (const row of rows) {
    const runId = String(row.id ?? "")
    const status = String(row.status ?? "")
    const organizationId = String(row.organization_id ?? "")
    const importJobId = String(row.import_job_id ?? "")
    const lease = (row.lease_expires_at as string | null) ?? null
    const heartbeat = (row.last_heartbeat_at as string | null) ?? null

    if (status !== "processing") {
      result.skipped += 1
      result.errors.push({ runId, message: `Run is not processing (status=${status}); not eligible for stale recovery.` })
      continue
    }
    const leaseExpired = lease ? lease < nowIso : true
    const heartbeatOld = heartbeat ? heartbeat < staleCutoff : true
    if (!leaseExpired && !heartbeatOld) {
      result.skipped += 1
      result.errors.push({ runId, message: "Run lease and heartbeat are still fresh; refusing to override active worker." })
      continue
    }

    const prevRecovery = (row.recovery_json as Record<string, unknown> | null) ?? {}
    const { error } = await svc
      .from("organization_import_job_runs")
      .update({
        status: "queued",
        lease_owner: null,
        lease_expires_at: null,
        last_heartbeat_at: nowIso,
        recovery_json: {
          ...prevRecovery,
          stale_lease_recovered_at: nowIso,
          stale_lease_recovered: true,
          bulk_recover_actor_kind: actor.actorKind ?? "platform_admin",
        },
      })
      .eq("id", runId)
      .eq("status", "processing")

    if (error) {
      result.errors.push({ runId, message: error.message })
      continue
    }

    await svc
      .from("organization_import_jobs")
      .update({
        status: "queued",
        user_message: "Stale lease recovered by platform admin. Run safely returned to queue.",
      })
      .eq("id", importJobId)
      .eq("organization_id", organizationId)

    await recordOperatorEvent({
      importJobId,
      importRunId: runId,
      organizationId,
      actorUserId: actor.actorUserId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorKind: actor.actorKind ?? "platform_admin",
      eventType: "bulk_recover_stale",
      severity: "warning",
      message: "Bulk stale-lease recovery: processing run released and re-queued.",
      metadata: {
        previousStatus: status,
        leaseExpiresAt: lease,
        lastHeartbeatAt: heartbeat,
      },
    })

    result.succeeded += 1
    result.affectedRuns.push({
      runId,
      importJobId,
      organizationId,
      previousStatus: status,
      nextStatus: "queued",
    })
  }

  return result
}
