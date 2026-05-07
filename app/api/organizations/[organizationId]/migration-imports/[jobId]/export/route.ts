import { NextResponse } from "next/server"
import { loadJobCsvFromStorage } from "@/lib/migration-imports/load-job-csv"
import { buildOutcomeCsv } from "@/lib/migration-imports/export-csv"
import type { RowOutcome } from "@/lib/migration-imports/types"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function dbStatusToOutcomeStatus(
  s: string,
): RowOutcome["status"] {
  if (s === "imported" || s === "updated" || s === "skipped" || s === "error" || s === "duplicate") {
    return s
  }
  return "skipped"
}

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

  const { supabase, svc } = gate

  const { searchParams } = new URL(request.url)
  const filterRaw = searchParams.get("filter") ?? "all"
  const filter = filterRaw === "failed" || filterRaw === "skipped" ? filterRaw : "all"

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("storage_path, file_name")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: "not_found", message: "Import job not found." }, { status: 404 })
  }

  const storagePath = (job as { storage_path: string | null }).storage_path
  if (!storagePath) {
    return NextResponse.json({ error: "no_file", message: "No CSV stored for this job." }, { status: 400 })
  }

  const { data: jobRows, error: rowErr } = await supabase
    .from("organization_import_job_rows")
    .select("row_index, status, codes, message, entity_id, snapshot")
    .eq("import_job_id", jobId)
    .order("row_index", { ascending: true })

  if (rowErr) {
    return NextResponse.json({ error: "query_failed", message: rowErr.message }, { status: 500 })
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

  const outcomes: RowOutcome[] = (jobRows ?? []).map((r) => {
    const row = r as {
      row_index: number
      status: string
      codes: string[] | null
      message: string | null
      entity_id: string | null
      snapshot: { cells?: Record<string, string> } | null
    }
    return {
      rowIndex: row.row_index,
      status: dbStatusToOutcomeStatus(row.status),
      codes: row.codes ?? [],
      message: row.message,
      entityId: row.entity_id ?? undefined,
      matchedLabel: null,
    }
  })

  const csv = buildOutcomeCsv(parsed.rows, outcomes, filter)
  const baseName = ((job as { file_name: string | null }).file_name ?? "import").replace(/\.[^.]+$/, "")
  const suffix = filter === "all" ? "full-outcomes" : filter === "failed" ? "errors" : "skipped"
  const filename = `${baseName}-${suffix}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
