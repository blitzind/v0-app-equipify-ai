import { NextResponse } from "next/server"
import { requireOrgInventoryRead } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgInventoryRead(organizationId)
  if ("error" in gate) return gate.error

  const sp = new URL(request.url).searchParams
  const limit = Math.min(Math.max(Number.parseInt(sp.get("limit") ?? "100", 10) || 100, 1), 500)
  const workOrderId = sp.get("work_order_id")?.trim()
  const locationId = sp.get("location_id")?.trim()
  const catalogItemId = sp.get("catalog_item_id")?.trim()

  let query = gate.svc
    .from("inventory_transactions")
    .select(
      "id, catalog_item_id, location_id, transaction_type, quantity, delta_on_hand, delta_allocated, correlation_id, work_order_id, purchase_order_id, invoice_id, counterparty_location_id, notes, created_at",
    )
    .eq("organization_id", organizationId)

  // Optional read-only filters — additive helpers that let downstream surfaces
  // (work order parts toolbar, mobile tech panel, recent activity card) avoid
  // pulling the full ledger and filtering client-side. UUIDs are validated to
  // keep injected values out of the query builder.
  if (workOrderId && UUID_RE.test(workOrderId)) query = query.eq("work_order_id", workOrderId)
  if (locationId && UUID_RE.test(locationId)) query = query.eq("location_id", locationId)
  if (catalogItemId && UUID_RE.test(catalogItemId)) query = query.eq("catalog_item_id", catalogItemId)

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ transactions: data ?? [] })
}
