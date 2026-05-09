import { NextResponse } from "next/server"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function costToUnitCents(cost: unknown): number {
  if (cost == null) return 0
  const n = Number(cost)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

/**
 * Phase 29 — Create an internal draft PO only (no external send / vendor automation).
 * Mirrors `purchase-order-store` line_items JSON shape for receive flows.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryWrite(organizationId)
  if ("error" in gate) return gate.error

  let body: {
    vendor_id?: string
    lines?: Array<{ catalog_item_id?: string; quantity?: number }>
    notes?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const vendorId = typeof body.vendor_id === "string" ? body.vendor_id.trim() : ""
  const linesRaw = Array.isArray(body.lines) ? body.lines : []

  if (!UUID_RE.test(vendorId)) {
    return NextResponse.json({ message: "vendor_id is required." }, { status: 400 })
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ message: "At least one line is required." }, { status: 400 })
  }

  const { data: vendor, error: vErr } = await gate.svc
    .from("org_vendors")
    .select("id, name, email, phone, contact_name, shipping_address, billing_address")
    .eq("organization_id", organizationId)
    .eq("id", vendorId)
    .maybeSingle()

  if (vErr) {
    return NextResponse.json({ message: vErr.message }, { status: 500 })
  }
  if (!vendor) {
    return NextResponse.json({ message: "Vendor not found." }, { status: 404 })
  }

  const qtyByCat = new Map<string, number>()
  for (const line of linesRaw) {
    const cid = typeof line.catalog_item_id === "string" ? line.catalog_item_id.trim() : ""
    const q = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : NaN
    if (!UUID_RE.test(cid) || !Number.isFinite(q) || q <= 0) {
      return NextResponse.json(
        { message: "Each line needs a valid catalog_item_id and positive quantity." },
        { status: 400 },
      )
    }
    const prev = qtyByCat.get(cid) ?? 0
    qtyByCat.set(cid, prev + q)
  }
  const catalogIds = [...qtyByCat.keys()]

  const { data: catRows, error: cErr } = await gate.svc
    .from("catalog_items")
    .select(
      "id, name, part_number, sku, unit, item_type, vendor_id, cost",
    )
    .eq("organization_id", organizationId)
    .in("id", catalogIds)

  if (cErr) {
    return NextResponse.json({ message: cErr.message }, { status: 500 })
  }

  const catMap = new Map((catRows ?? []).map((c) => [c.id as string, c]))
  for (const cid of catalogIds) {
    const row = catMap.get(cid)
    if (!row) {
      return NextResponse.json({ message: `Catalog item ${cid} not found.` }, { status: 404 })
    }
    if ((row as { vendor_id?: string }).vendor_id !== vendorId) {
      return NextResponse.json(
        { message: "Catalog items must match the selected preferred vendor." },
        { status: 400 },
      )
    }
  }

  const shipTo = String((vendor as { shipping_address?: string | null }).shipping_address ?? "").trim()
  const billTo = String((vendor as { billing_address?: string | null }).billing_address ?? "").trim()

  let totalCents = 0
  const lineItemsJson = catalogIds.map((cid) => {
    const cat = catMap.get(cid) as Record<string, unknown>
    const qty = Math.round(Number(qtyByCat.get(cid) ?? 0))
    const unitCostCents = costToUnitCents(cat.cost)
    const lineTotalCents = Math.round(qty * unitCostCents)
    totalCents += lineTotalCents
    const name = String(cat.name ?? "").trim()
    const pn = String(cat.part_number ?? "").trim()
    const description = pn ? `${pn} — ${name}` : name || "Catalog item"
    return {
      description,
      quantity: qty,
      unitCostCents,
      lineTotalCents,
      catalog_item_id: cid,
      sku_snapshot: typeof cat.sku === "string" ? cat.sku : null,
      item_type_snapshot: typeof cat.item_type === "string" ? cat.item_type : null,
      unit_label_snapshot: typeof cat.unit === "string" ? cat.unit : null,
    }
  })

  const notesExtra =
    typeof body.notes === "string" && body.notes.trim().length > 0 ?
      ` ${body.notes.trim().slice(0, 400)}`
    : ""

  const { data: inserted, error: insErr } = await gate.svc
    .from("org_purchase_orders")
    .insert({
      organization_id: organizationId,
      vendor_id: vendorId,
      vendor: String((vendor as { name?: string }).name ?? "Vendor").trim() || "Vendor",
      vendor_email: (vendor as { email?: string | null }).email ?? null,
      vendor_phone: (vendor as { phone?: string | null }).phone ?? null,
      vendor_contact_name: (vendor as { contact_name?: string | null }).contact_name ?? null,
      ship_to: shipTo || null,
      bill_to: billTo || null,
      status: "draft",
      total_cents: totalCents,
      line_items: lineItemsJson,
      notes: `Draft from Reorder Center — not sent.${notesExtra}`,
    })
    .select("id, purchase_order_number")
    .maybeSingle()

  if (insErr) {
    return NextResponse.json({ message: insErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    purchase_order_id: (inserted as { id: string } | null)?.id ?? null,
    purchase_order_number: (inserted as { purchase_order_number?: string } | null)?.purchase_order_number ?? null,
  })
}
