import { NextResponse } from "next/server"
import { getActiveCatalogJobForImport } from "@/lib/ai/jobs/active-catalog-job"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CANCEL_JOB_NOTE = "Cancelled by user."
const CANCEL_IMPORT_NOTE = "Import cancelled by user."

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

  const { svc } = gate
  const now = new Date().toISOString()

  const { data: row, error: loadErr } = await svc
    .from("price_list_imports")
    .select("id, status")
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr) {
    const schema = maybeCatalogSchemaErrorResponse(loadErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: loadErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Import not found." }, { status: 404 })
  }

  const importStatus = typeof row.status === "string" ? row.status : ""

  if (importStatus === "cancelled") {
    return NextResponse.json({ ok: true, already: true, status: "cancelled" })
  }

  if (importStatus === "needs_review" || importStatus === "approved") {
    return NextResponse.json(
      {
        error: "cannot_cancel",
        message: "This import already finished extraction. Start a new upload if you chose the wrong file.",
      },
      { status: 409 },
    )
  }

  const activeJobId = await getActiveCatalogJobForImport(svc, organizationId, importId)

  if (importStatus === "failed" && !activeJobId) {
    return NextResponse.json(
      {
        error: "cannot_cancel",
        message: "This import already failed. Use re-run extraction or upload a new file.",
      },
      { status: 409 },
    )
  }

  const canCancelImport =
    importStatus === "processing" ||
    importStatus === "uploaded" ||
    Boolean(activeJobId)

  if (!canCancelImport) {
    return NextResponse.json(
      { error: "cannot_cancel", message: "Nothing to cancel for this import." },
      { status: 409 },
    )
  }

  if (activeJobId) {
    const { error: jobErr } = await svc
      .from("ai_jobs")
      .update({
        status: "cancelled",
        completed_at: now,
        updated_at: now,
        error_message: CANCEL_JOB_NOTE,
        current_step: null,
      })
      .eq("id", activeJobId)
      .eq("organization_id", organizationId)
      .in("status", ["queued", "processing"])

    if (jobErr) {
      const schema = maybeCatalogSchemaErrorResponse(jobErr.message)
      if (schema) return schema
      return NextResponse.json({ error: "job_update_failed", message: jobErr.message }, { status: 500 })
    }
  }

  const { error: upErr } = await svc
    .from("price_list_imports")
    .update({
      status: "cancelled",
      error_message: CANCEL_IMPORT_NOTE,
      updated_at: now,
    })
    .eq("id", importId)
    .eq("organization_id", organizationId)

  if (upErr) {
    const schema = maybeCatalogSchemaErrorResponse(upErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "import_update_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    status: "cancelled",
    cancelledJobId: activeJobId ?? null,
  })
}
