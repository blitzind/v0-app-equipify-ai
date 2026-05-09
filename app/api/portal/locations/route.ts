import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"

export const runtime = "nodejs"

/**
 * Customer-scoped service sites for the signed-in portal account.
 * Omits internal notes and other staff-only fields.
 */
export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data, error } = await svc
    .from("customer_locations")
    .select("id, name, address_line1, address_line2, city, state, postal_code, is_default")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []).map((r) => {
    const row = r as {
      id: string
      name: string
      address_line1: string
      address_line2: string | null
      city: string
      state: string
      postal_code: string
      is_default: boolean | null
    }
    return {
      id: row.id,
      is_default: Boolean(row.is_default),
      label: formatCustomerLocationSelectLabel({
        name: row.name,
        address_line1: row.address_line1,
        address_line2: row.address_line2,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
      }),
    }
  })

  return NextResponse.json({ items })
}
