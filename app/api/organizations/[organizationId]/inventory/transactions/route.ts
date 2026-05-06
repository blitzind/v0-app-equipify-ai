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

  const limit = Math.min(Math.max(Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "100", 10) || 100, 1), 500)

  const { data, error } = await gate.svc
    .from("inventory_transactions")
    .select(
      "id, catalog_item_id, location_id, transaction_type, quantity, delta_on_hand, delta_allocated, correlation_id, work_order_id, purchase_order_id, invoice_id, counterparty_location_id, notes, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ transactions: data ?? [] })
}
