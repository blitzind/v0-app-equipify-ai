import { loadJobCsvFromStorageForAsync } from "./load-job-csv"
import { runCommit, type MigrationCommitOptions, type MigrationImportKind, type RowOutcome } from "./types"
import { resolveImportStrategy } from "./strategy"
import { MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE } from "./constants"
import { resolveMapped } from "./map-columns"

type Gate = {
  userId: string
  supabase: any
  svc: any
}

function fieldPulseEntityType(entityKind: string | undefined): string | null {
  if (entityKind === "customer") return "customer"
  if (entityKind === "equipment") return "equipment"
  if (entityKind === "work_order") return "work_order"
  if (entityKind === "invoice") return "invoice"
  return null
}

function sourceRecordId(kind: MigrationImportKind, row: Record<string, string>, mapping: Record<string, string>): string {
  const direct = resolveMapped(row, mapping, "source_record_id")
  if (direct) return direct
  if (kind === "customer") return resolveMapped(row, mapping, "external_code") || resolveMapped(row, mapping, "legacy_source_ids")
  if (kind === "equipment") return resolveMapped(row, mapping, "equipment_code")
  if (kind === "work_order") return resolveMapped(row, mapping, "work_order_number")
  if (kind === "invoice") return resolveMapped(row, mapping, "invoice_number")
  return ""
}

async function upsertFieldPulseMappings(params: {
  svc: any
  organizationId: string
  importJobId: string
  kind: MigrationImportKind
  rows: Record<string, string>[]
  rowOffset: number
  columnMapping: Record<string, string>
  outcomes: RowOutcome[]
}) {
  const now = new Date().toISOString()
  const payload = params.outcomes
    .map((outcome) => {
      const entityType = fieldPulseEntityType(outcome.entityKind)
      if (!entityType || !outcome.entityId || outcome.status === "error") return null
      const row = params.rows[outcome.rowIndex - params.rowOffset - 1] ?? {}
      const externalId = sourceRecordId(params.kind, row, params.columnMapping).trim()
      if (!externalId) return null
      return {
        organization_id: params.organizationId,
        provider: "fieldpulse",
        entity_type: entityType,
        internal_id: outcome.entityId,
        external_id: externalId,
        sync_status: "synced",
        last_synced_at: now,
        imported_at: now,
        import_job_id: params.importJobId,
        mapping_status: outcome.status === "imported" ? "created" : outcome.status === "updated" ? "updated" : "matched",
        mapping_confidence: 0.9,
        metadata: { source: "fieldpulse_csv_import", raw_snapshot: row },
        updated_at: now,
      }
    })
    .filter(Boolean)
  if (payload.length > 0) {
    await params.svc.from("external_sync_mappings").upsert(payload, {
      onConflict: "organization_id,provider,entity_type,internal_id",
    })
  }
}

export type AsyncRunPublic = {
  runId: string
  runRef: string
  status: string
  runMode: string
  chunkSize: number
  totalRows: number
  totalChunks: number
  currentChunkIndex: number
  processedCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  startedAt: string | null
  completedAt: string | null
  lastHeartbeatAt: string | null
  cancelRequestedAt: string | null
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  nextRetryAt: string | null
  leaseExpiresAt: string | null
  updatedAt: string | null
  createdAt: string | null
  recovery: Record<string, unknown> | null
  staleLeaseRecoveredAt: string | null
  isLikelyStuck: boolean
}

type StartRunInput = {
  gate: Gate
  organizationId: string
  jobId: string
  columnMapping?: Record<string, string>
  options?: MigrationCommitOptions
  chunkSize?: number
}

type ProcessRunOptions = {
  workerId?: string
  allowRetryWindowBypass?: boolean
}

export type CronImportRunCounters = {
  processed: number
  skipped: number
  retried: number
  failed: number
  leaseSkipped: number
}

const DEFAULT_MAX_RETRIES = 5
const LEASE_SECONDS = 45
const STALE_LEASE_GRACE_SECONDS = 120
const TRANSIENT_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "PGRST",
])

function clampChunkSize(size?: number): number {
  const n = Number.isFinite(size) ? Math.trunc(size as number) : MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE
  return Math.max(50, Math.min(2000, n))
}

function statusFromCounts(createdCount: number, updatedCount: number, errorCount: number) {
  if (errorCount > 0 && createdCount === 0 && updatedCount === 0) return "failed"
  if (errorCount > 0) return "completed_with_errors"
  return "completed"
}

function runRef(runId: string) {
  return runId.replace(/-/g, "").slice(0, 8).toUpperCase()
}

function jobStatusMessage(status: string, args: { processed?: number; total?: number; chunk?: number; totalChunks?: number }) {
  if (status === "queued") return "Queued for background processing."
  if (status === "processing") {
    const processed = args.processed ?? 0
    const total = args.total ?? 0
    const chunk = args.chunk ?? 0
    const totalChunks = args.totalChunks ?? 0
    return `Background import processing: ${processed}/${total} rows · chunk ${chunk}/${totalChunks}`
  }
  if (status === "cancel_requested") return "Cancellation requested. Current chunk will stop at the next checkpoint."
  if (status === "cancelled") return "Background import cancelled by request."
  if (status === "failed") return "Background import failed permanently after retry policy. Review run diagnostics before resuming."
  if (status === "completed") return "Background import completed."
  if (status === "completed_with_errors") return "Background import completed with some row errors."
  return "Import status updated."
}

function isTransientError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const err = e as { code?: string; message?: string }
  if (err.code && TRANSIENT_ERROR_CODES.has(err.code)) return true
  const msg = (err.message ?? "").toLowerCase()
  return msg.includes("timeout") || msg.includes("temporar") || msg.includes("connection reset") || msg.includes("deadlock")
}

function retryDelaySeconds(retryCount: number): number {
  return Math.min(300, 5 * 2 ** Math.max(0, retryCount - 1))
}

function isoAfterSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function isLikelyStuckRow(row: Record<string, unknown>): boolean {
  const status = String(row.status ?? "")
  if (status !== "processing") return false
  const lease = (row.lease_expires_at as string | null) ?? null
  const hb = (row.last_heartbeat_at as string | null) ?? null
  const nowMs = Date.now()
  const leaseMs = lease ? new Date(lease).getTime() : 0
  const hbMs = hb ? new Date(hb).getTime() : 0
  if (leaseMs && Number.isFinite(leaseMs) && leaseMs < nowMs) return true
  if (hbMs && Number.isFinite(hbMs) && nowMs - hbMs > STALE_LEASE_GRACE_SECONDS * 1000) return true
  return false
}

function mapRun(row: Record<string, unknown>): AsyncRunPublic {
  const runId = String(row.id ?? "")
  return {
    runId,
    runRef: runRef(runId),
    status: String(row.status ?? "queued"),
    runMode: String(row.run_mode ?? "async"),
    chunkSize: Number(row.chunk_size ?? 0),
    totalRows: Number(row.total_rows ?? 0),
    totalChunks: Number(row.total_chunks ?? 0),
    currentChunkIndex: Number(row.current_chunk_index ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    createdCount: Number(row.created_count ?? 0),
    updatedCount: Number(row.updated_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    errorCount: Number(row.error_count ?? 0),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    lastHeartbeatAt: (row.last_heartbeat_at as string | null) ?? null,
    cancelRequestedAt: (row.cancel_requested_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? DEFAULT_MAX_RETRIES),
    nextRetryAt: (row.next_retry_at as string | null) ?? null,
    leaseExpiresAt: (row.lease_expires_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    recovery: (row.recovery_json as Record<string, unknown> | null) ?? null,
    staleLeaseRecoveredAt:
      (row.recovery_json as Record<string, unknown> | null)?.stale_lease_recovered_at as string | null,
    isLikelyStuck: isLikelyStuckRow(row),
  }
}

export async function getActiveImportRun(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase } = gate
  const { data, error } = await supabase
    .from("organization_import_job_runs")
    .select(
      "id, status, run_mode, chunk_size, total_rows, total_chunks, current_chunk_index, processed_count, created_count, updated_count, skipped_count, error_count, started_at, completed_at, last_heartbeat_at, cancel_requested_at, error_message, retry_count, max_retries, next_retry_at, lease_expires_at, recovery_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapRun(data as Record<string, unknown>)
}

export async function listImportRunsHistory(
  gate: Gate,
  organizationId: string,
  jobId: string,
  limit = 8,
): Promise<AsyncRunPublic[]> {
  const { supabase } = gate
  const { data } = await supabase
    .from("organization_import_job_runs")
    .select(
      "id, status, run_mode, chunk_size, total_rows, total_chunks, current_chunk_index, processed_count, created_count, updated_count, skipped_count, error_count, started_at, completed_at, last_heartbeat_at, cancel_requested_at, error_message, retry_count, max_retries, next_retry_at, lease_expires_at, recovery_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 25)))
  return (data ?? []).map((d: Record<string, unknown>) => mapRun(d))
}

export async function startAsyncImportRun(input: StartRunInput): Promise<{ run: AsyncRunPublic; accepted: boolean }> {
  const { gate, organizationId, jobId } = input
  const { supabase, svc, userId } = gate

  const existing = await getActiveImportRun(gate, organizationId, jobId)
  if (existing) return { run: existing, accepted: false }

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("kind, storage_path, column_mapping, options, status, source_system")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()
  if (jobErr || !job) throw new Error("Import job not found.")

  const j = job as {
    kind: MigrationImportKind
    storage_path: string | null
    column_mapping: Record<string, string> | null
    options: Record<string, unknown> | null
    status: string
    source_system: string | null
  }
  if (!j.storage_path) throw new Error("No uploaded file for this job.")
  if (j.status === "processing") throw new Error("Import is already running.")
  if (j.kind === "quickbooks_snapshot" || j.kind === "certificate") throw new Error("This job type is not committable yet.")

  const parsed = await loadJobCsvFromStorageForAsync(svc, j.storage_path)
  const chunkSize = clampChunkSize(input.chunkSize)
  const totalRows = parsed.rows.length
  const totalChunks = totalRows === 0 ? 0 : Math.ceil(totalRows / chunkSize)
  const options: MigrationCommitOptions = {
    strategy: input.options?.strategy,
    duplicateStrategy: input.options?.duplicateStrategy,
    linkChildrenToExistingParents: input.options?.linkChildrenToExistingParents,
    skipQuickBooksInvoiceSync: true,
  }
  const strategy = resolveImportStrategy(options)
  const columnMapping = { ...(j.column_mapping ?? {}), ...(input.columnMapping ?? {}) }

  await supabase.from("organization_import_job_rows").delete().eq("import_job_id", jobId)

  const now = new Date().toISOString()
  const { data: run, error: runErr } = await supabase
    .from("organization_import_job_runs")
    .insert({
      import_job_id: jobId,
      organization_id: organizationId,
      run_mode: "async",
      status: "queued",
      chunk_size: chunkSize,
      total_rows: totalRows,
      total_chunks: totalChunks,
      current_chunk_index: 0,
      resume_cursor: 0,
      processed_count: 0,
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      metadata: { strategy, options, columnMapping, sourceSystem: j.source_system ?? null },
      created_by: userId,
      committed_by: userId,
      started_at: now,
      last_heartbeat_at: now,
      retry_count: 0,
      max_retries: DEFAULT_MAX_RETRIES,
      next_retry_at: null,
      last_error_at: null,
      error_message: null,
      recovery_json: {},
    })
    .select(
      "id, status, run_mode, chunk_size, total_rows, total_chunks, current_chunk_index, processed_count, created_count, updated_count, skipped_count, error_count, started_at, completed_at, last_heartbeat_at, cancel_requested_at, error_message",
    )
    .single()
  if (runErr || !run) throw new Error(runErr?.message ?? "Could not start async run.")

  await supabase
    .from("organization_import_jobs")
    .update({
      status: "queued",
      started_at: now,
      completed_at: null,
      user_message: "Background import queued.",
      active_run_id: (run as { id: string }).id,
      processed_count: 0,
      success_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      cancel_requested_at: null,
      strategy,
      committed_by: userId,
      options: { ...options, strategy },
      column_mapping: columnMapping,
    })
    .eq("organization_id", organizationId)
    .eq("id", jobId)

  return { run: mapRun(run as Record<string, unknown>), accepted: true }
}

function offsetOutcomes(outcomes: RowOutcome[], offset: number): RowOutcome[] {
  return outcomes.map((o) => ({ ...o, rowIndex: o.rowIndex + offset }))
}

async function processRunById(
  gate: Gate,
  runId: string,
  opts?: ProcessRunOptions,
): Promise<{ run: AsyncRunPublic | null; leaseDenied?: boolean }> {
  const { supabase, svc, userId } = gate
  const workerId = (opts?.workerId?.trim() || `worker-${Math.random().toString(36).slice(2, 10)}`).slice(0, 64)
  const now = new Date().toISOString()
  const leaseExpires = isoAfterSeconds(LEASE_SECONDS)

  const { data: leased, error: leaseErr } = await supabase
    .from("organization_import_job_runs")
    .update({
      lease_owner: workerId,
      lease_expires_at: leaseExpires,
      last_heartbeat_at: now,
      status: "processing",
    })
    .eq("id", runId)
    .in("status", ["queued", "processing"])
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${now}`)
    .select("*")
    .maybeSingle()

  if (leaseErr || !leased) return { run: null, leaseDenied: true }

  const run = leased as Record<string, unknown>
  const organizationId = String(run.organization_id ?? "")
  const jobId = String(run.import_job_id ?? "")
  const nextRetryAt = (run.next_retry_at as string | null) ?? null
  if (!opts?.allowRetryWindowBypass && nextRetryAt && nextRetryAt > now) {
    return { run: mapRun(run), leaseDenied: true }
  }

  const meta = (run.metadata as Record<string, unknown> | null) ?? {}
  const columnMapping = (meta.columnMapping as Record<string, string> | undefined) ?? {}
  const options = (meta.options as MigrationCommitOptions | undefined) ?? {}
  const strategy = resolveImportStrategy(options)

  try {
    const { data: job, error: jobErr } = await supabase
      .from("organization_import_jobs")
      .select("kind, storage_path, cancel_requested_at, source_system")
      .eq("organization_id", organizationId)
      .eq("id", jobId)
      .single()
    if (jobErr || !job) throw new Error(jobErr?.message ?? "Import job not found.")

    const j = job as { kind: MigrationImportKind; storage_path: string | null; cancel_requested_at: string | null; source_system: string | null }
    if (!j.storage_path) throw new Error("No uploaded file for this job.")

    const cancelRequested = Boolean(run.cancel_requested_at) || Boolean(j.cancel_requested_at)
    if (cancelRequested) {
      await supabase
        .from("organization_import_job_runs")
        .update({
          status: "cancelled",
          completed_at: now,
          last_heartbeat_at: now,
          recovery_json: {
            reason: "cancel_requested",
            resume_cursor: run.resume_cursor ?? 0,
            current_chunk_index: run.current_chunk_index ?? 0,
          },
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", runId)
      await supabase
        .from("organization_import_jobs")
        .update({
          status: "cancelled",
          completed_at: now,
          user_message: jobStatusMessage("cancelled", {}),
          active_run_id: null,
        })
        .eq("organization_id", organizationId)
        .eq("id", jobId)
      return { run: null }
    }

    const parsed = await loadJobCsvFromStorageForAsync(svc, j.storage_path)
    const chunkSize = Number(run.chunk_size ?? MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE)
    const totalRows = parsed.rows.length
    const cursor = Number(run.resume_cursor ?? 0)
    const nextRows = parsed.rows.slice(cursor, cursor + chunkSize)

    await supabase
      .from("organization_import_jobs")
      .update({
        status: "processing",
        started_at: (run.started_at as string | null) ?? now,
        user_message: jobStatusMessage("processing", {
          processed: Number(run.processed_count ?? 0),
          total: totalRows,
          chunk: Math.floor(cursor / chunkSize) + 1,
          totalChunks: Math.max(1, Math.ceil(totalRows / chunkSize)),
        }),
      })
      .eq("id", jobId)
      .eq("organization_id", organizationId)

    if (nextRows.length === 0) {
      const createdCount = Number(run.created_count ?? 0)
      const updatedCount = Number(run.updated_count ?? 0)
      const skippedCount = Number(run.skipped_count ?? 0)
      const errorCount = Number(run.error_count ?? 0)
      const finalStatus = statusFromCounts(createdCount, updatedCount, errorCount)
      await supabase
        .from("organization_import_job_runs")
        .update({
          status: finalStatus,
          completed_at: now,
          last_heartbeat_at: now,
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", runId)
      await supabase
        .from("organization_import_jobs")
        .update({
          status: finalStatus,
          completed_at: now,
          user_message: `${createdCount} created · ${updatedCount} updated · ${skippedCount} skipped · ${errorCount} errors`,
          active_run_id: null,
          strategy,
        })
        .eq("id", jobId)
        .eq("organization_id", organizationId)
      return { run: null }
    }

    const result = await runCommit({
      supabase,
      organizationId,
      userId,
      columnMapping,
      rows: nextRows,
      options,
      kind: j.kind,
      importSeedPrefix: `${jobId}-r-${runId}-c-${Math.floor(cursor / chunkSize)}`,
    })

    const offset = cursor
    const shifted = offsetOutcomes(result.outcomes, offset)
    const rowPayload = shifted.map((o, idx) => ({
      import_job_id: jobId,
      row_index: o.rowIndex,
      status: o.status === "imported" ? "imported" : o.status,
      codes: o.codes,
      message: o.message,
      entity_kind: o.entityKind ?? null,
      entity_id: o.entityId ?? null,
      snapshot: { cells: nextRows[idx] ?? {} } as Record<string, unknown>,
    }))
    if (rowPayload.length > 0) {
      await supabase.from("organization_import_job_rows").upsert(rowPayload, { onConflict: "import_job_id,row_index" })
    }
    const sourceSystem = String(j.source_system ?? meta.sourceSystem ?? "")
    if (sourceSystem.toLowerCase().includes("fieldpulse")) {
      await upsertFieldPulseMappings({
        svc,
        organizationId,
        importJobId: jobId,
        kind: j.kind,
        rows: nextRows,
        rowOffset: offset,
        columnMapping,
        outcomes: shifted,
      })
    }

    const processedCount = Number(run.processed_count ?? 0) + nextRows.length
    const createdCount = Number(run.created_count ?? 0) + result.createdCount
    const updatedCount = Number(run.updated_count ?? 0) + result.updatedCount
    const skippedCount = Number(run.skipped_count ?? 0) + result.skippedCount
    const errorCount = Number(run.error_count ?? 0) + result.errorCount
    const nextCursor = cursor + nextRows.length
    const totalChunks = Math.max(1, Math.ceil(totalRows / chunkSize))
    const currentChunkIndex = Math.min(totalChunks, Math.ceil(nextCursor / chunkSize))
    const done = nextCursor >= totalRows
    const finalStatus = done ? statusFromCounts(createdCount, updatedCount, errorCount) : "processing"

    await supabase
      .from("organization_import_job_runs")
      .update({
        status: finalStatus,
        total_rows: totalRows,
        total_chunks: totalChunks,
        current_chunk_index: currentChunkIndex,
        resume_cursor: nextCursor,
        processed_count: processedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        last_heartbeat_at: now,
        completed_at: done ? now : null,
        retry_count: done ? Number(run.retry_count ?? 0) : Number(run.retry_count ?? 0),
        next_retry_at: null,
        error_message: null,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", runId)

    await supabase
      .from("organization_import_jobs")
      .update({
        status: finalStatus,
        processed_count: processedCount,
        success_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        strategy,
        completed_at: done ? now : null,
        user_message: done
          ? `${createdCount} created · ${updatedCount} updated · ${skippedCount} skipped · ${errorCount} errors`
          : jobStatusMessage("processing", {
              processed: processedCount,
              total: totalRows,
              chunk: currentChunkIndex,
              totalChunks,
            }),
        active_run_id: done ? null : runId,
      })
      .eq("id", jobId)
      .eq("organization_id", organizationId)

    const fresh = await getActiveImportRun(gate, organizationId, jobId)
    if (fresh) return { run: fresh }
    return { run: null }
  } catch (e) {
    const retryCount = Number(run.retry_count ?? 0) + 1
    const maxRetries = Number(run.max_retries ?? DEFAULT_MAX_RETRIES)
    const transient = isTransientError(e)
    const nowErr = new Date().toISOString()
    if (transient && retryCount <= maxRetries) {
      const nextRetryAt = isoAfterSeconds(retryDelaySeconds(retryCount))
      await supabase
        .from("organization_import_job_runs")
        .update({
          status: "queued",
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          last_error_at: nowErr,
          error_message: e instanceof Error ? e.message : "Transient processing failure.",
          last_heartbeat_at: nowErr,
          recovery_json: {
            reason: "transient_failure",
            retry_count: retryCount,
            resume_cursor: run.resume_cursor ?? 0,
            current_chunk_index: run.current_chunk_index ?? 0,
          },
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", runId)
      await supabase
        .from("organization_import_jobs")
        .update({
          status: "queued",
          user_message: `Retrying background import (${retryCount}/${maxRetries}). Next attempt scheduled automatically.`,
        })
        .eq("id", jobId)
        .eq("organization_id", organizationId)
      return { run: await getActiveImportRun(gate, organizationId, jobId) }
    }

    await supabase
      .from("organization_import_job_runs")
      .update({
        status: "failed",
        completed_at: nowErr,
        last_error_at: nowErr,
        error_message: e instanceof Error ? e.message : "Background import failed.",
        recovery_json: {
          reason: transient ? "retry_exhausted" : "non_transient_failure",
          retry_count: retryCount,
          resume_cursor: run.resume_cursor ?? 0,
          current_chunk_index: run.current_chunk_index ?? 0,
        },
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", runId)
    await supabase
      .from("organization_import_jobs")
      .update({
        status: "failed",
        completed_at: nowErr,
        user_message: jobStatusMessage("failed", {}),
        active_run_id: null,
      })
      .eq("id", jobId)
      .eq("organization_id", organizationId)
    throw e
  }
}

export async function processAsyncImportRunTick(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase } = gate
  const { data: runData, error: runErr } = await supabase
    .from("organization_import_job_runs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runErr || !runData) return null
  const runId = String((runData as { id: string }).id)
  const result = await processRunById(gate, runId)
  return result.run
}

export async function processNextRunnableImportRun(
  gate: Gate,
  opts?: ProcessRunOptions,
): Promise<{ processed: boolean; run: AsyncRunPublic | null; counters: CronImportRunCounters }> {
  const counters: CronImportRunCounters = {
    processed: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    leaseSkipped: 0,
  }
  const { supabase } = gate
  const now = new Date().toISOString()
  const { data: runData } = await supabase
    .from("organization_import_job_runs")
    .select("id")
    .in("status", ["queued", "processing"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!runData) return { processed: false, run: null, counters }
  const runId = String((runData as { id: string }).id)
  const { data: beforeData } = await supabase
    .from("organization_import_job_runs")
    .select("status, retry_count")
    .eq("id", runId)
    .maybeSingle()
  const before = beforeData as { status?: string; retry_count?: number } | null
  const result = await processRunById(gate, runId, opts)
  if (result.leaseDenied) {
    counters.leaseSkipped += 1
    return { processed: false, run: result.run, counters }
  }
  counters.processed += 1
  const { data: afterData } = await supabase
    .from("organization_import_job_runs")
    .select("status, retry_count")
    .eq("id", runId)
    .maybeSingle()
  const after = afterData as { status?: string; retry_count?: number } | null
  if (after?.status === "queued" && typeof after.retry_count === "number" && typeof before?.retry_count === "number" && after.retry_count > before.retry_count) {
    counters.retried += 1
  }
  if (after?.status === "failed") counters.failed += 1
  if (after?.status === "cancelled") counters.skipped += 1
  return { processed: true, run: result.run, counters }
}

export async function recoverStaleLeases(gate: Gate): Promise<number> {
  const { supabase } = gate
  const nowIso = new Date().toISOString()
  const staleBefore = isoAfterSeconds(-STALE_LEASE_GRACE_SECONDS)
  const { data: staleRows } = await supabase
    .from("organization_import_job_runs")
    .select("id, import_job_id, organization_id, status, recovery_json")
    .eq("status", "processing")
    .or(`lease_expires_at.lt.${nowIso},last_heartbeat_at.lt.${staleBefore}`)
    .limit(50)
  if (!staleRows || staleRows.length === 0) return 0

  for (const r of staleRows as Array<Record<string, unknown>>) {
    const runId = String(r.id)
    const orgId = String(r.organization_id)
    const jobId = String(r.import_job_id)
    const oldRecovery = (r.recovery_json as Record<string, unknown> | null) ?? {}
    await supabase
      .from("organization_import_job_runs")
      .update({
        status: "queued",
        lease_owner: null,
        lease_expires_at: null,
        last_heartbeat_at: nowIso,
        recovery_json: {
          ...oldRecovery,
          stale_lease_recovered_at: nowIso,
          stale_lease_recovered: true,
        },
      })
      .eq("id", runId)
    await supabase
      .from("organization_import_jobs")
      .update({
        status: "queued",
        user_message: "Stale lease recovered. Run safely returned to queue for retry.",
      })
      .eq("organization_id", orgId)
      .eq("id", jobId)
  }
  return staleRows.length
}

export async function resumeFailedImportRun(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic> {
  const { supabase } = gate
  const active = await getActiveImportRun(gate, organizationId, jobId)
  if (active) throw new Error("An active run already exists.")

  const { data: failedRun, error } = await supabase
    .from("organization_import_job_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !failedRun) throw new Error("No failed run available to resume.")

  const prev = failedRun as Record<string, unknown>
  const now = new Date().toISOString()
  const prevRecovery = (prev.recovery_json as Record<string, unknown> | null) ?? {}
  await supabase
    .from("organization_import_job_runs")
    .update({
      status: "queued",
      completed_at: null,
      error_message: null,
      next_retry_at: null,
      lease_owner: null,
      lease_expires_at: null,
      last_heartbeat_at: now,
      recovery_json: {
        ...prevRecovery,
        resumed_at: now,
        resumed_from_status: "failed",
        resume_cursor: prev.resume_cursor ?? 0,
      },
    })
    .eq("id", String(prev.id))

  await supabase
    .from("organization_import_jobs")
    .update({
      status: "queued",
      active_run_id: String(prev.id),
      completed_at: null,
      user_message: "Run resumed from recovery cursor metadata.",
    })
    .eq("organization_id", organizationId)
    .eq("id", jobId)

  const { data: resumed } = await supabase
    .from("organization_import_job_runs")
    .select("*")
    .eq("id", String(prev.id))
    .single()
  return mapRun((resumed ?? prev) as Record<string, unknown>)
}

export async function requestCancelAsyncRun(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase } = gate
  const now = new Date().toISOString()
  await supabase
    .from("organization_import_jobs")
    .update({
      cancel_requested_at: now,
      user_message: jobStatusMessage("cancel_requested", {}),
    })
    .eq("organization_id", organizationId)
    .eq("id", jobId)

  await supabase
    .from("organization_import_job_runs")
    .update({
      cancel_requested_at: now,
      last_heartbeat_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .in("status", ["queued", "processing"])

  return getActiveImportRun(gate, organizationId, jobId)
}
