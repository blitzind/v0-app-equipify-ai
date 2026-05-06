import { NextResponse } from "next/server"
import { normalizeCatalogCompatibility } from "@/lib/catalog/catalog-compatibility"
import { requireOrgCatalogWrite, requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LIST_SELECT =
  "id, vendor_id, manufacturer_name, category, item_type, part_number, sku, name, description, list_price, cost, sale_price, margin_percent, unit, taxable, status, archived_at, replacement_part_number, effective_date, confidence_score, ai_generated, ai_confidence, human_verified_at, source_file_name, price_source, source_type, created_at, vendor:org_vendors(name)"

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error

  const limitRaw = new URL(request.url).searchParams.get("limit")
  const includeArchived = new URL(request.url).searchParams.get("include_archived") === "1"
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? "300", 10) || 300, 1), 500)

  let q = gate.svc
    .from("catalog_items")
    .select(LIST_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!includeArchived) q = q.is("archived_at", null)

  const { data, error } = await q

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>
    const vendor = row.vendor as { name?: string } | null | undefined
    return {
      ...row,
      vendor_name: vendor?.name ?? null,
      vendor: undefined,
    }
  })

  return NextResponse.json({ items: rows })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgCatalogWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON." }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  if (!name) {
    return NextResponse.json({ error: "validation", message: "Name is required." }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const compatibility =
    body.compatibility !== undefined && typeof body.compatibility === "object" && body.compatibility !== null
      ? normalizeCatalogCompatibility(body.compatibility as Record<string, unknown>)
      : {}

  const verificationMode = String(body.verification_mode ?? "verified").toLowerCase()
  let rowStatus = String(body.status ?? "active").trim() || "active"
  let humanVerifiedAt: string | null = nowIso
  let humanVerifiedBy: string | null = gate.userId
  if (verificationMode === "needs_review") {
    rowStatus = "needs_review"
    humanVerifiedAt = null
    humanVerifiedBy = null
  } else if (verificationMode === "pending") {
    humanVerifiedAt = null
    humanVerifiedBy = null
  }

  const sale =
    typeof body.sale_price === "number" && Number.isFinite(body.sale_price) ? body.sale_price : null
  const listFromBody =
    typeof body.list_price === "number" && Number.isFinite(body.list_price) ? body.list_price : null
  const listPrice = listFromBody ?? sale

  const row = {
    organization_id: organizationId,
    vendor_id: body.vendor_id === undefined || body.vendor_id === "" ? null : body.vendor_id,
    manufacturer_name:
      body.manufacturer_name === undefined || body.manufacturer_name === null
        ? null
        : String(body.manufacturer_name).trim() || null,
    source_type: "manual" as const,
    source_file_name: "manual_entry",
    category: String(body.category ?? "").trim(),
    item_type: String(body.item_type ?? "other").trim() || "other",
    part_number: String(body.part_number ?? "").trim(),
    sku: body.sku === undefined || body.sku === null ? null : String(body.sku).trim() || null,
    name,
    description: body.description === undefined || body.description === null ? null : String(body.description).trim() || null,
    list_price: listPrice,
    cost: typeof body.cost === "number" && Number.isFinite(body.cost) ? body.cost : null,
    sale_price: sale,
    margin_percent:
      typeof body.margin_percent === "number" && Number.isFinite(body.margin_percent) ? body.margin_percent : null,
    unit: String(body.unit ?? "ea").trim() || "ea",
    taxable: typeof body.taxable === "boolean" ? body.taxable : true,
    status: rowStatus,
    replacement_part_number:
      body.replacement_part_number === undefined || body.replacement_part_number === null
        ? null
        : String(body.replacement_part_number).trim() || null,
    discontinued_replacement_notes:
      body.discontinued_replacement_notes === undefined || body.discontinued_replacement_notes === null
        ? null
        : String(body.discontinued_replacement_notes).trim() || null,
    effective_date:
      body.effective_date === undefined || body.effective_date === null || body.effective_date === ""
        ? null
        : String(body.effective_date).slice(0, 10),
    notes: body.notes === undefined || body.notes === null ? null : String(body.notes).trim() || null,
    price_source: body.price_source === undefined ? "Manual entry" : String(body.price_source ?? "").trim() || "Manual entry",
    compatibility,
    ai_generated: false,
    ai_confidence: null,
    confidence_score: null,
    human_verified_at: humanVerifiedAt,
    human_verified_by: humanVerifiedBy,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { data: inserted, error } = await gate.svc.from("catalog_items").insert(row).select("id").maybeSingle()

  if (error) {
    const schema = maybeCatalogSchemaErrorResponse(error.message)
    if (schema) return schema
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 })
  }

  const id = (inserted as { id: string } | null)?.id
  return NextResponse.json({ id })
}
