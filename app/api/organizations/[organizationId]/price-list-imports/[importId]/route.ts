import { NextResponse } from "next/server"
import { getActiveCatalogJobForImport } from "@/lib/ai/jobs/active-catalog-job"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"
import { normalizeCatalogImportPayload } from "@/lib/catalog/catalog-import-manufacturer"
import type { StoredPriceListPayload } from "@/lib/catalog/import-types"
import { requireOrgCatalogWrite, requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error

  const { data: row, error } = await gate.svc
    .from("price_list_imports")
    .select(
      "id, organization_id, uploaded_by, vendor_id, manufacturer_name, file_name, file_url, status, extracted_json, error_message, created_at, updated_at",
    )
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Import not found." }, { status: 404 })
  }

  const payload = parseStoredPriceListPayload(row.extracted_json)

  const activeJobId = await getActiveCatalogJobForImport(gate.svc, organizationId, importId)

  return NextResponse.json({
    import: row,
    payload,
    activeJobId,
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const payloadRaw = (body as { payload?: unknown }).payload
  const payload = payloadRaw as StoredPriceListPayload | null
  if (!payload || payload.version !== 1 || !Array.isArray(payload.rows)) {
    return NextResponse.json({ error: "invalid_payload", message: "Provide payload.version 1 with rows[]." }, { status: 400 })
  }

  const normalizedPayload = normalizeCatalogImportPayload(payload)

  const { data: existing, error: loadErr } = await gate.svc
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
  if (!existing) {
    return NextResponse.json({ error: "not_found", message: "Import not found." }, { status: 404 })
  }

  if ((existing.status as string) === "cancelled") {
    return NextResponse.json(
      { error: "cannot_patch_cancelled", message: "This import was cancelled. Start a new upload or re-run extraction." },
      { status: 409 },
    )
  }

  const { error: upErr } = await gate.svc
    .from("price_list_imports")
    .update({
      extracted_json: normalizedPayload as unknown as Record<string, unknown>,
      manufacturer_name: normalizedPayload.manufacturerName ?? null,
      status: existing.status === "failed" ? "needs_review" : existing.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId)

  if (upErr) {
    const schema = maybeCatalogSchemaErrorResponse(upErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "save_failed", message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
