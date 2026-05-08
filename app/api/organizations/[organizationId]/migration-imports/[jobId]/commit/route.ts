import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadJobCsvFromStorage } from "@/lib/migration-imports/load-job-csv"
import { runCommit } from "@/lib/migration-imports/types"
import type { MigrationCommitOptions, MigrationImportKind } from "@/lib/migration-imports/types"
import { outcomesForClient } from "@/lib/migration-imports/public-response"
import { resolveImportStrategy } from "@/lib/migration-imports/strategy"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"
import { resolveMapped } from "@/lib/migration-imports/map-columns"

export const runtime = "nodejs"
export const maxDuration = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  if (kind === "customer") {
    return resolveMapped(row, mapping, "external_code") || resolveMapped(row, mapping, "legacy_source_ids")
  }
  if (kind === "equipment") return resolveMapped(row, mapping, "equipment_code")
  if (kind === "work_order") return resolveMapped(row, mapping, "work_order_number")
  if (kind === "invoice") return resolveMapped(row, mapping, "invoice_number")
  return ""
}

async function upsertFieldPulseMappings(params: {
  svc: SupabaseClient
  organizationId: string
  importJobId: string
  kind: MigrationImportKind
  rows: Record<string, string>[]
  columnMapping: Record<string, string>
  outcomes: Array<{ rowIndex: number; status: string; entityKind?: string; entityId?: string }>
}) {
  const now = new Date().toISOString()
  const payload = params.outcomes
    .map((outcome) => {
      const entityType = fieldPulseEntityType(outcome.entityKind)
      if (!entityType || !outcome.entityId || outcome.status === "error") return null
      const row = params.rows[outcome.rowIndex - 1] ?? {}
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
        mapping_status:
          outcome.status === "imported" ? "created" : outcome.status === "updated" ? "updated" : "matched",
        mapping_confidence: 0.9,
        metadata: {
          source: "fieldpulse_csv_import",
          raw_snapshot: row,
        },
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

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; jobId: string }> },
) {
  const { organizationId, jobId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const { userId, supabase, svc } = gate

  let body: {
    columnMapping?: Record<string, string>
    options?: MigrationCommitOptions
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON." }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("kind, storage_path, column_mapping, status, source_system")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: "not_found", message: "Import job not found." }, { status: 404 })
  }

  const status = (job as { status: string }).status
  if (status === "processing") {
    return NextResponse.json({ error: "busy", message: "Import is already running." }, { status: 409 })
  }

  const kind = (job as { kind: MigrationImportKind }).kind
  if (kind === "quickbooks_snapshot" || kind === "certificate") {
    return NextResponse.json(
      { error: "not_committable", message: "This job type does not support CSV commit yet." },
      { status: 400 },
    )
  }

  const storagePath = (job as { storage_path: string | null }).storage_path
  if (!storagePath) {
    return NextResponse.json({ error: "no_file", message: "No uploaded file for this job." }, { status: 400 })
  }

  let parsed
  try {
    parsed = await loadJobCsvFromStorage(svc, storagePath)
  } catch (e) {
    return NextResponse.json(
      { error: "download_failed", message: e instanceof Error ? e.message : "Download failed" },
      { status: 400 },
    )
  }

  const baseMap = (job as { column_mapping: Record<string, string> }).column_mapping ?? {}
  const columnMapping = { ...baseMap, ...(body.columnMapping ?? {}) }
  const options: MigrationCommitOptions = {
    strategy: body.options?.strategy,
    duplicateStrategy: body.options?.duplicateStrategy,
    linkChildrenToExistingParents: body.options?.linkChildrenToExistingParents,
    skipQuickBooksInvoiceSync: true,
  }
  const strategy = resolveImportStrategy(options)

  const started = new Date().toISOString()

  const jobUpdate: Record<string, unknown> = {
    status: "processing",
    started_at: started,
    options: { ...options, strategy } as Record<string, unknown>,
    column_mapping: columnMapping,
    completed_at: null,
    user_message: null,
    strategy,
    committed_by: userId,
    active_run_id: null,
    cancel_requested_at: null,
    processed_count: 0,
  }

  await supabase.from("organization_import_jobs").update(jobUpdate).eq("id", jobId)

  const result = await runCommit({
    supabase,
    organizationId,
    userId,
    columnMapping,
    rows: parsed.rows,
    options,
    kind,
    importSeedPrefix: jobId,
  })

  const sourceSystem = String((job as { source_system?: string | null }).source_system ?? "")
  if (sourceSystem.toLowerCase().includes("fieldpulse")) {
    await upsertFieldPulseMappings({
      svc,
      organizationId,
      importJobId: jobId,
      kind,
      rows: parsed.rows,
      columnMapping,
      outcomes: result.outcomes,
    })
  }

  await supabase.from("organization_import_job_rows").delete().eq("import_job_id", jobId)

  const rowPayload = result.outcomes.map((o) => ({
    import_job_id: jobId,
    row_index: o.rowIndex,
    status: o.status === "imported" ? "imported" : o.status,
    codes: o.codes,
    message: o.message,
    entity_kind: o.entityKind ?? null,
    entity_id: o.entityId ?? null,
    snapshot: { cells: parsed.rows[o.rowIndex - 1] ?? {} } as Record<string, unknown>,
  }))

  if (rowPayload.length > 0) {
    const { error: rowErr } = await supabase.from("organization_import_job_rows").insert(rowPayload)
    if (rowErr) {
      await supabase
        .from("organization_import_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          user_message: rowErr.message,
        })
        .eq("id", jobId)
      return NextResponse.json({ error: "row_log_failed", message: rowErr.message }, { status: 500 })
    }
  }

  const completed = new Date().toISOString()

  let finalStatus: "completed" | "completed_with_errors" | "failed"
  if (result.errorCount > 0 && result.createdCount === 0 && result.updatedCount === 0) {
    finalStatus = "failed"
  } else if (result.errorCount > 0) {
    finalStatus = "completed_with_errors"
  } else {
    finalStatus = "completed"
  }

  const summaryMsg = [
    `${result.createdCount} created`,
    result.updatedCount ? `${result.updatedCount} updated` : null,
    result.skippedCount ? `${result.skippedCount} skipped` : null,
    result.errorCount ? `${result.errorCount} errors` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const countsUpdate: Record<string, unknown> = {
    status: finalStatus,
    success_count: result.createdCount,
    updated_count: result.updatedCount,
    skipped_count: result.skippedCount,
    error_count: result.errorCount,
    completed_at: completed,
    user_message: summaryMsg,
    strategy,
    active_run_id: null,
    processed_count: result.createdCount + result.updatedCount + result.skippedCount + result.errorCount,
  }

  await supabase.from("organization_import_jobs").update(countsUpdate).eq("id", jobId)

  return NextResponse.json({
    ok: finalStatus !== "failed",
    status: finalStatus,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    successCount: result.createdCount,
    skippedCount: result.skippedCount,
    errorCount: result.errorCount,
    outcomes: outcomesForClient(result.outcomes),
    importRef: jobId.replace(/-/g, "").slice(0, 8).toUpperCase(),
    strategy,
  })
}
