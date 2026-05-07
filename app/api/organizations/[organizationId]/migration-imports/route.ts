import { NextResponse } from "next/server"
import {
  MIGRATION_IMPORT_MAX_BYTES,
  MIGRATION_IMPORT_MAX_ROWS,
  ORGANIZATION_IMPORTS_BUCKET,
} from "@/lib/migration-imports/constants"
import { parseCsvText } from "@/lib/migration-imports/parse-csv"
import { suggestColumnMapping } from "@/lib/migration-imports/map-columns"
import { buildPreview } from "@/lib/migration-imports/types"
import type { MigrationImportKind } from "@/lib/migration-imports/types"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const KINDS = new Set<MigrationImportKind>([
  "customer",
  "equipment",
  "invoice",
  "work_order",
  "certificate",
  "quickbooks_snapshot",
  "generic",
])

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const { supabase } = gate

  const { data, error } = await supabase
    .from("organization_import_jobs")
    .select(
      "id, kind, source_system, status, file_name, row_count, success_count, error_count, created_at, completed_at, user_message",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    if (error.message.includes("organization_import_jobs") || error.message.includes("schema cache")) {
      return NextResponse.json(
        {
          error: "schema_missing",
          message: "Migration import tables are not available. Apply the latest database migrations.",
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  const jobs = (data ?? []).map((row: Record<string, unknown>) => {
    const id = String(row.id ?? "")
    return {
      jobId: id,
      importRef: id.replace(/-/g, "").slice(0, 8).toUpperCase(),
      kind: row.kind,
      source_system: row.source_system,
      status: row.status,
      file_name: row.file_name,
      row_count: row.row_count,
      success_count: row.success_count,
      error_count: row.error_count,
      created_at: row.created_at,
      completed_at: row.completed_at,
      user_message: row.user_message,
    }
  })

  return NextResponse.json({ jobs })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMigrationAccess(organizationId)
  if ("error" in gate) return gate.error

  const { userId, supabase, svc } = gate

  const contentType = request.headers.get("content-type") ?? ""
  let kindRaw = "customer"
  let sourceSystem: string | null = null
  let mappingOverride: Record<string, string> | null = null
  let file: File | null = null
  let textBody: string | null = null

  if (contentType.includes("multipart/form-data")) {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: "invalid_body", message: "Could not read form." }, { status: 400 })
    }
    const k = form.get("kind")
    kindRaw = typeof k === "string" ? k : "customer"
    const src = form.get("sourceSystem")
    sourceSystem = typeof src === "string" && src.trim() ? src.trim() : null
    const mapField = form.get("columnMapping")
    if (typeof mapField === "string" && mapField.trim()) {
      try {
        mappingOverride = JSON.parse(mapField) as Record<string, string>
      } catch {
        return NextResponse.json({ error: "invalid_mapping", message: "columnMapping must be JSON." }, { status: 400 })
      }
    }
    const f = form.get("file")
    file = f instanceof File && f.size > 0 ? f : null
  } else if (contentType.includes("application/json")) {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
    }
    kindRaw = typeof body.kind === "string" ? body.kind : "quickbooks_snapshot"
    sourceSystem = typeof body.sourceSystem === "string" ? body.sourceSystem : null
    textBody = typeof body.text === "string" ? body.text : null
  } else {
    return NextResponse.json(
      { error: "invalid_content_type", message: "Use multipart form or JSON." },
      { status: 400 },
    )
  }

  const kind = kindRaw as MigrationImportKind
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid_kind", message: "Unsupported import kind." }, { status: 400 })
  }

  if (kind === "quickbooks_snapshot") {
    const { data: ins, error } = await supabase
      .from("organization_import_jobs")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        kind: "quickbooks_snapshot",
        source_system: sourceSystem,
        status: "completed",
        file_name: null,
        storage_path: null,
        column_mapping: {},
        options: {},
        preview_json: {
          summary:
            "QuickBooks operational continuity: connect under Integrations and run invoice/customer sync. Full historical pull is staged for a later release.",
        },
        validation_summary: {},
        row_count: 0,
        success_count: 0,
        error_count: 0,
        user_message:
          "Recorded migration intent. Use Settings → Integrations → QuickBooks for live sync; historical backfill will extend this job type.",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error || !ins) {
      return NextResponse.json({ error: "insert_failed", message: error?.message ?? "Failed." }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      jobId: (ins as { id: string }).id,
      kind,
      status: "completed",
    })
  }

  let buffer: Buffer
  let fileName = "upload.csv"

  if (file) {
    if (file.size > MIGRATION_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large", message: "File exceeds 30MB limit." }, { status: 400 })
    }
    fileName = file.name || "upload.csv"
    buffer = Buffer.from(await file.arrayBuffer())
  } else if (textBody) {
    buffer = Buffer.from(textBody, "utf8")
  } else {
    return NextResponse.json(
      { error: "missing_file", message: "Attach a CSV file (or send JSON with text for small fixtures)." },
      { status: 400 },
    )
  }

  const text = buffer.toString("utf8")
  const parsedFull = parseCsvText(text, MIGRATION_IMPORT_MAX_ROWS + 1)
  const truncated = parsedFull.rows.length > MIGRATION_IMPORT_MAX_ROWS
  const rows = truncated ? parsedFull.rows.slice(0, MIGRATION_IMPORT_MAX_ROWS) : parsedFull.rows
  const parsed = { headers: parsedFull.headers, rows }

  if (parsedFull.headers.length === 0 || rows.length === 0) {
    return NextResponse.json(
      { error: "empty_file", message: "No data rows found in CSV." },
      { status: 400 },
    )
  }

  const suggested = suggestColumnMapping(kind, parsedFull.headers)
  const column_mapping = { ...suggested, ...(mappingOverride ?? {}) }

  const previewResult = await buildPreview({
    supabase,
    organizationId,
    userId,
    columnMapping: column_mapping,
    rows,
    options: {},
    kind,
  })

  const { data: jobIns, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      kind,
      source_system: sourceSystem,
      status: "draft",
      file_name: fileName,
      storage_path: null,
      column_mapping,
      options: {},
      preview_json: {
        headers: parsedFull.headers,
        truncated,
        sample: previewResult.sampleRows.slice(0, 15),
      },
      validation_summary: {
        ...previewResult.summary,
        duplicateHints: previewResult.duplicateHints.length,
        unresolvedRefs: previewResult.unresolvedRefs.length,
        truncated,
      },
      row_count: rows.length,
      success_count: 0,
      error_count: 0,
    })
    .select("id")
    .single()

  if (jobErr || !jobIns) {
    return NextResponse.json({ error: "insert_failed", message: jobErr?.message ?? "Failed." }, { status: 500 })
  }

  const jobId = (jobIns as { id: string }).id
  const storagePath = `${organizationId}/${jobId}.csv`

  const { error: upErr } = await svc.storage.from(ORGANIZATION_IMPORTS_BUCKET).upload(storagePath, buffer, {
    contentType: "text/csv",
    upsert: true,
  })

  if (upErr) {
    await supabase.from("organization_import_jobs").delete().eq("id", jobId)
    return NextResponse.json({ error: "upload_failed", message: upErr.message }, { status: 400 })
  }

  await supabase.from("organization_import_jobs").update({ storage_path: storagePath }).eq("id", jobId)

  return NextResponse.json({
    ok: true,
    jobId,
    kind,
    status: "draft",
    columnMapping: column_mapping,
    preview: previewResult,
    rowCount: rows.length,
    truncated,
  })
}
