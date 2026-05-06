import { NextResponse } from "next/server"
import { normalizeCatalogCompatibility, parseCatalogCompatibility } from "@/lib/catalog/catalog-compatibility"
import { requireOrgCatalogWrite, requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SELECT_DETAIL =
  "id, organization_id, vendor_id, manufacturer_name, category, item_type, part_number, sku, name, description, list_price, cost, sale_price, margin_percent, unit, taxable, status, replacement_part_number, discontinued_replacement_notes, effective_date, notes, raw_extracted_text, confidence_score, ai_generated, ai_confidence, human_verified_at, human_verified_by, source_file_name, source_file_url, source_import_id, price_source, source_type, compatibility, archived_at, created_at, updated_at, vendor:org_vendors(name)"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error

  const { data, error } = await gate.svc
    .from("catalog_items")
    .select(SELECT_DETAIL)
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle()

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "not_found", message: "Catalog item not found." }, { status: 404 })
  }

  const row = data as Record<string, unknown>
  const vendor = row.vendor as { name?: string } | null | undefined
  const compatibility = parseCatalogCompatibility(row.compatibility)

  return NextResponse.json({
    item: {
      ...data,
      vendor_name: vendor?.name ?? null,
      compatibility,
    },
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const row: Record<string, unknown> = {}
  const str = (k: string) => (typeof body[k] === "string" ? body[k] : undefined)
  const num = (k: string) => (typeof body[k] === "number" && Number.isFinite(body[k]) ? body[k] : undefined)
  const bool = (k: string) => (typeof body[k] === "boolean" ? body[k] : undefined)

  if (str("name") !== undefined) row.name = String(body.name ?? "").trim()
  if (str("part_number") !== undefined) row.part_number = String(body.part_number ?? "").trim()
  if (body.sku !== undefined) row.sku = body.sku === null ? null : String(body.sku).trim() || null
  if (body.manufacturer_name !== undefined)
    row.manufacturer_name = body.manufacturer_name === null ? null : String(body.manufacturer_name).trim() || null
  if (body.vendor_id !== undefined) row.vendor_id = body.vendor_id === null || body.vendor_id === "" ? null : body.vendor_id
  if (str("category") !== undefined) row.category = String(body.category ?? "").trim()
  if (str("item_type") !== undefined) row.item_type = String(body.item_type ?? "").trim()
  if (str("status") !== undefined) row.status = String(body.status ?? "").trim()
  if (body.description !== undefined) row.description = body.description === null ? null : String(body.description).trim() || null
  if (body.notes !== undefined) row.notes = body.notes === null ? null : String(body.notes).trim() || null
  if (body.list_price !== undefined) row.list_price = body.list_price === null ? null : num("list_price")
  if (body.cost !== undefined) row.cost = body.cost === null ? null : num("cost")
  if (body.sale_price !== undefined) row.sale_price = body.sale_price === null ? null : num("sale_price")
  if (body.margin_percent !== undefined) row.margin_percent = body.margin_percent === null ? null : num("margin_percent")
  if (bool("taxable") !== undefined) row.taxable = body.taxable
  if (str("unit") !== undefined) row.unit = String(body.unit ?? "").trim() || "ea"
  if (body.effective_date !== undefined)
    row.effective_date = body.effective_date === null || body.effective_date === "" ? null : String(body.effective_date).slice(0, 10)
  if (body.price_source !== undefined)
    row.price_source = body.price_source === null ? null : String(body.price_source).trim() || null
  if (body.replacement_part_number !== undefined)
    row.replacement_part_number =
      body.replacement_part_number === null ? null : String(body.replacement_part_number).trim() || null
  if (body.discontinued_replacement_notes !== undefined)
    row.discontinued_replacement_notes =
      body.discontinued_replacement_notes === null ? null : String(body.discontinued_replacement_notes).trim() || null
  if (body.compatibility !== undefined) {
    const merge = normalizeCatalogCompatibility(body.compatibility as Record<string, unknown>)
    row.compatibility = merge
  }
  if (body.archived !== undefined) {
    if (body.archived === true) row.archived_at = new Date().toISOString()
    else if (body.archived === false) row.archived_at = null
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "empty", message: "No changes." }, { status: 400 })
  }

  row.updated_at = new Date().toISOString()

  const { data: updated, error } = await gate.svc
    .from("catalog_items")
    .update(row)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .select(SELECT_DETAIL)
    .maybeSingle()

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 })
  }

  if (!updated) {
    return NextResponse.json({ error: "not_found", message: "Catalog item not found." }, { status: 404 })
  }

  const urow = updated as Record<string, unknown>
  const vendor = urow.vendor as { name?: string } | null | undefined

  return NextResponse.json({
    item: {
      ...updated,
      vendor_name: vendor?.name ?? null,
      compatibility: parseCatalogCompatibility(urow.compatibility),
    },
  })
}
