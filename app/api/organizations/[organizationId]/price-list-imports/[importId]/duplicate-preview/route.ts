import { NextResponse } from "next/server"
import { findDuplicateCatalogItemId } from "@/lib/catalog/duplicate-find"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"
import { requireOrgCatalogWrite } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; importId: string }> },
) {
  const { organizationId, importId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(importId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: { rowIds?: string[] }
  try {
    body = (await request.json()) as { rowIds?: string[] }
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const rowIds = Array.isArray(body.rowIds) ? body.rowIds.filter((id): id is string => typeof id === "string") : []

  const { data: row, error } = await gate.svc
    .from("price_list_imports")
    .select("extracted_json, manufacturer_name")
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
  if (!payload) {
    return NextResponse.json({ error: "no_payload", message: "Nothing extracted yet." }, { status: 400 })
  }

  const idSet = new Set(rowIds.length ? rowIds : payload.rows.filter((r) => r.selected).map((r) => r.id))

  const mfg = payload.manufacturerName ?? (row.manufacturer_name as string | null)

  const conflicts: { rowId: string; existingCatalogItemId: string }[] = []

  for (const r of payload.rows) {
    if (!idSet.has(r.id)) continue
    const dup = await findDuplicateCatalogItemId(gate.svc, organizationId, {
      partNumber: r.partNumber,
      manufacturerName: mfg,
      name: r.name,
    })
    if (dup) conflicts.push({ rowId: r.id, existingCatalogItemId: dup })
  }

  return NextResponse.json({ ok: true, conflicts })
}
