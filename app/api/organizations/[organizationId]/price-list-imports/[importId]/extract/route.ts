import { NextResponse } from "next/server"
import { getActiveCatalogJobForImport } from "@/lib/ai/jobs/active-catalog-job"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import { scheduleCatalogExtractionProcessing } from "@/lib/ai/jobs/schedule-catalog-extraction"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"
export const maxDuration = 300

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  const { svc, userId } = gate

  const { data: row, error: loadErr } = await svc
    .from("price_list_imports")
    .select("id, file_url")
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr) {
    const schema = maybeCatalogSchemaErrorResponse(loadErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: loadErr.message }, { status: 500 })
  }
  if (!row?.file_url) {
    return NextResponse.json({ error: "not_found", message: "Import or stored file missing." }, { status: 404 })
  }

  const existingActive = await getActiveCatalogJobForImport(svc, organizationId, importId)
  if (existingActive) {
    return NextResponse.json({
      ok: true,
      jobId: existingActive,
      importId,
      resumed: true,
      status: "queued",
      message: "Extraction already running for this import.",
    })
  }

  await svc
    .from("price_list_imports")
    .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", importId)

  const jobInsert = await insertQueuedAiJob(svc, {
    organization_id: organizationId,
    created_by: userId,
    task: "catalog_extraction",
    input_json: {
      kind: "price_list_import_reextract",
      importId,
    },
    source_type: "price_list_import",
    source_id: importId,
  })

  if ("error" in jobInsert) {
    return NextResponse.json({ error: "job_create_failed", message: jobInsert.error }, { status: 500 })
  }

  const jobId = jobInsert.jobId

  scheduleCatalogExtractionProcessing({
    organizationId,
    jobId,
    importIdForCleanup: importId,
  })

  return NextResponse.json({
    ok: true,
    jobId,
    importId,
    status: "queued",
  })
}
