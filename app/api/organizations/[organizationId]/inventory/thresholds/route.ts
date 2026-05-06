import { NextResponse } from "next/server"
import { requireOrgInventoryWrite } from "@/lib/inventory/require-org-inventory-access"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Update reorder_point / reorder_quantity for a stock row (no quantity movement). */
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

  let body: { stock_id?: string; reorder_point?: number | null; reorder_quantity?: number | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 })
  }

  const stockId = typeof body.stock_id === "string" ? body.stock_id.trim() : ""
  if (!UUID_RE.test(stockId)) {
    return NextResponse.json({ message: "stock_id is required." }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.reorder_point !== undefined) patch.reorder_point = body.reorder_point
  if (body.reorder_quantity !== undefined) patch.reorder_quantity = body.reorder_quantity

  const { error } = await gate.svc
    .from("inventory_stock")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", stockId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
