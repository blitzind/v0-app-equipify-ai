import { NextResponse } from "next/server"
import { requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? "300", 10) || 300, 1), 500)

  const { data, error } = await gate.svc
    .from("catalog_items")
    .select(
      "id, manufacturer_name, category, item_type, part_number, sku, name, description, list_price, cost, sale_price, unit, status, replacement_part_number, effective_date, notes, confidence_score, source_file_name, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: "load_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
