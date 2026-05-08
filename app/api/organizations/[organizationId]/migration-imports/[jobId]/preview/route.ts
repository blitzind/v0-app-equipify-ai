import { NextResponse } from "next/server"
import { MIGRATION_IMPORT_MAX_ROWS } from "@/lib/migration-imports/constants"
import { loadJobCsvFromStorage } from "@/lib/migration-imports/load-job-csv"
import { computeImportProjection } from "@/lib/migration-imports/import-projection"
import { resolveImportStrategy } from "@/lib/migration-imports/strategy"
import { buildPreview } from "@/lib/migration-imports/types"
import type { MigrationCommitOptions, MigrationImportKind } from "@/lib/migration-imports/types"
import { requireOrgMigrationAccess } from "@/lib/migration-imports/require-org-migration-access"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  let body: { columnMapping?: Record<string, string>; options?: MigrationCommitOptions }
  try {
    body = (await request.json()) as { columnMapping?: Record<string, string>; options?: MigrationCommitOptions }
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Expected JSON." }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from("organization_import_jobs")
    .select("kind, storage_path, column_mapping")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: "not_found", message: "Import job not found." }, { status: 404 })
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

  const kind = (job as { kind: MigrationImportKind }).kind
  const baseMap = (job as { column_mapping: Record<string, string> }).column_mapping ?? {}
  const columnMapping = { ...baseMap, ...(body.columnMapping ?? {}) }
  const options: MigrationCommitOptions = {
    strategy: body.options?.strategy,
    duplicateStrategy: body.options?.duplicateStrategy,
    linkChildrenToExistingParents: body.options?.linkChildrenToExistingParents,
  }
  const strategy = resolveImportStrategy(options)

  const preview = await buildPreview({
    supabase,
    organizationId,
    userId,
    columnMapping,
    rows: parsed.rows,
    options,
    kind,
  })

  const projection = await computeImportProjection({
    supabase,
    organizationId,
    userId,
    columnMapping,
    rows: parsed.rows,
    options,
    kind,
  })
  const previewWithProjection = { ...preview, projection }

  await supabase
    .from("organization_import_jobs")
    .update({
      column_mapping: columnMapping,
      preview_json: {
        headers: parsed.headers,
        truncated: parsed.rows.length >= MIGRATION_IMPORT_MAX_ROWS,
        sample: preview.sampleRows.slice(0, 15),
      },
      validation_summary: {
        ...preview.summary,
        duplicateHints: preview.duplicateHints.length,
        unresolvedRefs: preview.unresolvedRefs.length,
        strategy,
        projection,
      },
      row_count: parsed.rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)

  return NextResponse.json({ ok: true, preview: previewWithProjection, columnMapping, strategy })
}
