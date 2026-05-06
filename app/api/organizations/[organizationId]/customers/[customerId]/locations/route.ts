import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { clearOtherDefaultCustomerLocations } from "@/lib/customer-locations/clear-default"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LOCATION_ROLES = new Set(["owner", "admin", "manager"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status })
}

type Body = {
  name?: string
  address?: string
  addressLine2?: string | null
  city?: string
  state?: string
  zip?: string
  phone?: string | null
  contactPerson?: string | null
  notes?: string | null
  isDefault?: boolean
}

/**
 * Create a customer_locations row after membership + billing checks.
 * Persists with service role so writes succeed regardless of RLS edge cases.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid organization or customer.", 400)
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const address = typeof body.address === "string" ? body.address.trim() : ""
  const city = typeof body.city === "string" ? body.city.trim() : ""
  const state = typeof body.state === "string" ? body.state.trim() : ""
  const zip = typeof body.zip === "string" ? body.zip.trim() : ""

  if (!name || !address || !city || !state || !zip) {
    return jsonError("Name, street address, city, state, and ZIP are required.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return jsonError("Sign in required.", 401)
  }

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  const role = (mem as { role?: string } | null)?.role ?? ""
  if (!LOCATION_ROLES.has(role)) {
    return jsonError("Only owners, admins, and managers can add locations.", 403)
  }

  const gate = await requireCanCreateRecord(supabase, user.id, organizationId, "customer")
  if (!gate.ok) {
    return jsonError(gate.message ?? "Cannot create records for this workspace.", gate.httpStatus ?? 403)
  }

  const { data: cust } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()

  if (!cust) {
    return jsonError("Customer not found in this organization.", 404)
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server configuration error.", 503)
  }

  const isDefault = Boolean(body.isDefault)
  if (isDefault) {
    const { error: clearErr } = await clearOtherDefaultCustomerLocations(svc, {
      organizationId,
      customerId,
    })
    if (clearErr) {
      return jsonError(clearErr.message, 400)
    }
  }

  const row = {
    organization_id: organizationId,
    customer_id: customerId,
    name,
    address_line1: address,
    address_line2:
      typeof body.addressLine2 === "string" && body.addressLine2.trim()
        ? body.addressLine2.trim()
        : null,
    city,
    state,
    postal_code: zip,
    phone:
      typeof body.phone === "string" && body.phone.trim() ? body.phone.trim().slice(0, 64) : null,
    contact_person:
      typeof body.contactPerson === "string" && body.contactPerson.trim()
        ? body.contactPerson.trim().slice(0, 200)
        : null,
    notes:
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    is_default: isDefault,
    archived_at: null as string | null,
  }

  const { data: inserted, error: insErr } = await svc
    .from("customer_locations")
    .insert(row)
    .select(
      "id, name, address_line1, address_line2, city, state, postal_code, phone, contact_person, notes, is_default",
    )
    .maybeSingle()

  if (insErr) {
    return jsonError(insErr.message, 400)
  }
  if (!inserted) {
    return jsonError("Insert did not return a row.", 500)
  }

  return NextResponse.json({ ok: true, location: inserted })
}
