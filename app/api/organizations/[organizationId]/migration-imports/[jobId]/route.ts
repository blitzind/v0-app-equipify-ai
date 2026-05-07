import { NextResponse } from "next/server"
import { shortImportRef } from "@/lib/migration-imports/parse-csv"
import { getActiveImportRun } from "@/lib/migration-imports/async-runner"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_ROW_SAMPLE = 500

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; jobId: string }> },
) {
  const { organizationId, jobId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const { supabase } = gate

  const { searchParams } = new URL(request.url)
  const rowLimitRaw = parseInt(searchParams.get("rowLimit") ?? String(MAX_ROW_SAMPLE), 10)
  const rowLimit = Number.isFinite(rowLimitRaw) ? Math.min(Math.max(rowLimitRaw, 0), MAX_ROW_SAMPLE) : MAX_ROW_SAMPLE

  const { data: job, error } = await supabase
    .from("organization_import_jobs")
    .select(
      "kind, source_system, status, file_name, storage_path, column_mapping, options, preview_json, validation_summary, row_count, processed_count, success_count, error_count, skipped_count, updated_count, strategy, user_message, cancel_requested_at, created_at, started_at, completed_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }
  if (!job) {
    return NextResponse.json({ error: "not_found", message: "Import job not found." }, { status: 404 })
  }

  const j = job as Record<string, unknown>
  const canExport = typeof j.storage_path === "string" && j.storage_path.length > 0

  let rows: {
    rowIndex: number
    status: string
    codes: string[]
    message: string | null
    recordRef: string | null
    cells: Record<string, string> | null
  }[] = []

  if (rowLimit > 0) {
    const { data: jobRows, error: rowErr } = await supabase
      .from("organization_import_job_rows")
      .select("row_index, status, codes, message, entity_id, snapshot")
      .eq("import_job_id", jobId)
      .order("row_index", { ascending: true })
      .limit(rowLimit)

    if (rowErr) {
      return NextResponse.json({ error: "query_failed", message: rowErr.message }, { status: 500 })
    }

    rows =
      jobRows?.map((r) => {
        const row = r as {
          row_index: number
          status: string
          codes: string[] | null
          message: string | null
          entity_id: string | null
          snapshot: { cells?: Record<string, string> } | null
        }
        const entityId = row.entity_id
        return {
          rowIndex: row.row_index,
          status: row.status,
          codes: row.codes ?? [],
          message: row.message,
          recordRef: entityId ? shortImportRef(entityId) : null,
          cells: row.snapshot?.cells ?? null,
        }
      }) ?? []
  }

  const partialImport = j.status === "completed_with_errors"
  const activeRun = await getActiveImportRun(gate, organizationId, jobId)

  return NextResponse.json({
    job: {
      jobId,
      importRef: jobId.replace(/-/g, "").slice(0, 8).toUpperCase(),
      kind: j.kind,
      source_system: j.source_system,
      status: j.status,
      file_name: j.file_name,
      column_mapping: j.column_mapping,
      options: j.options,
      preview_json: j.preview_json,
      validation_summary: j.validation_summary,
      row_count: j.row_count,
      processed_count: j.processed_count,
      success_count: j.success_count,
      updated_count: j.updated_count,
      skipped_count: j.skipped_count,
      error_count: j.error_count,
      strategy: j.strategy,
      user_message: j.user_message,
      created_at: j.created_at,
      started_at: j.started_at,
      completed_at: j.completed_at,
      partialImport,
      canExport,
      cancel_requested_at: j.cancel_requested_at,
    },
    activeRun,
    rows,
    rowSampleLimit: rowLimit,
  })
}
