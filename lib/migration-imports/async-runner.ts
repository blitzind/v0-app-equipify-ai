import { loadJobCsvFromStorageForAsync } from "./load-job-csv"
import { runCommit, type MigrationCommitOptions, type MigrationImportKind, type RowOutcome } from "./types"
import { resolveImportStrategy } from "./strategy"
import { MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE } from "./constants"

type Gate = {
  userId: string
  supabase: any
  svc: any
}

export type AsyncRunPublic = {
  runId: string
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
}

type StartRunInput = {
  gate: Gate
  organizationId: string
  jobId: string
  columnMapping?: Record<string, string>
  options?: MigrationCommitOptions
  chunkSize?: number
}

function clampChunkSize(size?: number): number {
  const n = Number.isFinite(size) ? Math.trunc(size as number) : MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE
  return Math.max(50, Math.min(2000, n))
}

function statusFromCounts(createdCount: number, updatedCount: number, errorCount: number) {
  if (errorCount > 0 && createdCount === 0 && updatedCount === 0) return "failed"
  if (errorCount > 0) return "completed_with_errors"
  return "completed"
}

function mapRun(row: Record<string, unknown>): AsyncRunPublic {
  return {
    runId: String(row.id ?? ""),
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
  }
}

export async function getActiveImportRun(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase } = gate
  const { data, error } = await supabase
    .from("organization_import_job_runs")
    .select(
      "id, status, run_mode, chunk_size, total_rows, total_chunks, current_chunk_index, processed_count, created_count, updated_count, skipped_count, error_count, started_at, completed_at, last_heartbeat_at, cancel_requested_at, error_message",
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

export async function startAsyncImportRun(input: StartRunInput): Promise<{ run: AsyncRunPublic; accepted: boolean }> {
  const { gate, organizationId, jobId } = input
  const { supabase, svc, userId } = gate

  const existing = await getActiveImportRun(gate, organizationId, jobId)
  if (existing) return { run: existing, accepted: false }

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("kind, storage_path, column_mapping, options, status")
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
      metadata: { strategy, options, columnMapping },
      created_by: userId,
      committed_by: userId,
      started_at: now,
      last_heartbeat_at: now,
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

export async function processAsyncImportRunTick(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase, svc, userId } = gate
  const { data: runData, error: runErr } = await supabase
    .from("organization_import_job_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("import_job_id", jobId)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runErr || !runData) return null

  const run = runData as Record<string, unknown>
  const runId = String(run.id)
  const meta = (run.metadata as Record<string, unknown> | null) ?? {}
  const columnMapping = (meta.columnMapping as Record<string, string> | undefined) ?? {}
  const options = (meta.options as MigrationCommitOptions | undefined) ?? {}
  const strategy = resolveImportStrategy(options)

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("kind, storage_path, cancel_requested_at")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .single()
  if (jobErr || !job) throw new Error(jobErr?.message ?? "Import job not found.")

  const j = job as { kind: MigrationImportKind; storage_path: string | null; cancel_requested_at: string | null }
  if (!j.storage_path) throw new Error("No uploaded file for this job.")

  const cancelRequested = Boolean(run.cancel_requested_at) || Boolean(j.cancel_requested_at)
  if (cancelRequested) {
    const now = new Date().toISOString()
    await supabase
      .from("organization_import_job_runs")
      .update({
        status: "cancelled",
        completed_at: now,
        last_heartbeat_at: now,
      })
      .eq("id", runId)
    await supabase
      .from("organization_import_jobs")
      .update({
        status: "cancelled",
        completed_at: now,
        user_message: "Background import cancelled by user request.",
        active_run_id: null,
      })
      .eq("organization_id", organizationId)
      .eq("id", jobId)
    return getActiveImportRun(gate, organizationId, jobId)
  }

  const parsed = await loadJobCsvFromStorageForAsync(svc, j.storage_path)
  const chunkSize = Number(run.chunk_size ?? MIGRATION_IMPORT_ASYNC_DEFAULT_CHUNK_SIZE)
  const totalRows = parsed.rows.length
  const cursor = Number(run.resume_cursor ?? 0)
  const nextRows = parsed.rows.slice(cursor, cursor + chunkSize)

  const now = new Date().toISOString()
  await supabase
    .from("organization_import_job_runs")
    .update({
      status: "processing",
      started_at: (run.started_at as string | null) ?? now,
      last_heartbeat_at: now,
    })
    .eq("id", runId)
  await supabase
    .from("organization_import_jobs")
    .update({
      status: "processing",
      started_at: (run.started_at as string | null) ?? now,
      user_message: `Processing chunk ${Math.floor(cursor / chunkSize) + 1} of ${Math.max(1, Math.ceil(totalRows / chunkSize))}...`,
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
    return null
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
        : `Processed ${processedCount}/${totalRows} rows · chunk ${currentChunkIndex}/${totalChunks}`,
      active_run_id: done ? null : runId,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)

  const fresh = await getActiveImportRun(gate, organizationId, jobId)
  if (fresh) return fresh

  const { data: doneRun } = await supabase
    .from("organization_import_job_runs")
    .select(
      "id, status, run_mode, chunk_size, total_rows, total_chunks, current_chunk_index, processed_count, created_count, updated_count, skipped_count, error_count, started_at, completed_at, last_heartbeat_at, cancel_requested_at, error_message",
    )
    .eq("id", runId)
    .maybeSingle()
  return doneRun ? mapRun(doneRun as Record<string, unknown>) : null
}

export async function requestCancelAsyncRun(gate: Gate, organizationId: string, jobId: string): Promise<AsyncRunPublic | null> {
  const { supabase } = gate
  const now = new Date().toISOString()
  await supabase
    .from("organization_import_jobs")
    .update({
      cancel_requested_at: now,
      user_message: "Cancellation requested. Current chunk will stop at next checkpoint.",
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
