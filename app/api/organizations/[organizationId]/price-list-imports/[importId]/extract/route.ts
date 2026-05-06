import { NextResponse, after } from "next/server"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import {
  failAiJob,
  runPriceListImportExtractionJob,
  sanitizeAiJobError,
} from "@/lib/ai/jobs/process-ai-job"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
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
    return NextResponse.json({ error: "not_found", message: "Import or stored PDF missing." }, { status: 404 })
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

  after(async () => {
    let sr
    try {
      sr = createServiceRoleSupabaseClient()
    } catch {
      return
    }
    try {
      await runPriceListImportExtractionJob({
        svc: sr,
        organizationId,
        jobId,
      })
    } catch (e) {
      console.error("[ai_jobs] catalog re-extract:", e)
      const msg = sanitizeAiJobError(e)
      try {
        await failAiJob(sr, jobId, msg)
        await sr
          .from("price_list_imports")
          .update({
            status: "failed",
            error_message: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", importId)
      } catch (inner) {
        console.error("[ai_jobs] catalog re-extract cleanup:", inner)
      }
    }
  })

  return NextResponse.json({
    ok: true,
    jobId,
    importId,
  })
}
