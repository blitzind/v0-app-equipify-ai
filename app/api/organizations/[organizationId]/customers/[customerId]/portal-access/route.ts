import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

type PortalUserRow = {
  id: string
  email: string
  status: string
  display_name: string | null
  last_login_at: string | null
  activated_at: string | null
}

function accessEnabled(users: PortalUserRow[]): boolean {
  return users.some((u) => u.status === "pending" || u.status === "active")
}

/**
 * Staff: list portal identities for a customer (drives the persisted access toggle).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid organization or customer.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManagePortalSettings")
  if ("error" in gate) return gate.error

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: cust } = await svc
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle()
  if (!cust) return jsonError("Customer not found for this organization.", 404)

  const { data, error } = await svc
    .from("portal_users")
    .select("id, email, status, display_name, last_login_at, activated_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true })

  if (error) return jsonError("Could not load portal access.", 500)

  const users = (data ?? []) as PortalUserRow[]
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      displayName: u.display_name,
      lastLoginAt: u.last_login_at,
    })),
    accessEnabled: accessEnabled(users),
  })
}

/**
 * Staff: enable (restore) or disable (revoke) all portal users for this customer.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid organization or customer.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManagePortalSettings")
  if ("error" in gate) return gate.error

  let body: { enabled?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  if (typeof body.enabled !== "boolean") {
    return jsonError("enabled is required.", 400)
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: existing, error: listErr } = await svc
    .from("portal_users")
    .select("id, status, activated_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)

  if (listErr) return jsonError("Could not update portal access.", 500)

  const rows = (existing ?? []) as Array<{ id: string; status: string; activated_at: string | null }>
  if (rows.length === 0) {
    if (body.enabled) {
      return jsonError("Send a portal invite before enabling access.", 409)
    }
    return NextResponse.json({ accessEnabled: false, users: [] })
  }

  const nowIso = new Date().toISOString()

  if (!body.enabled) {
    const { error } = await svc
      .from("portal_users")
      .update({ status: "revoked" })
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
    if (error) return jsonError("Could not disable portal access.", 500)

    await svc
      .from("portal_access_links")
      .update({ revoked_at: nowIso })
      .eq("organization_id", organizationId)
      .in(
        "portal_user_id",
        rows.map((r) => r.id),
      )
      .is("revoked_at", null)

    return NextResponse.json({ accessEnabled: false })
  }

  for (const row of rows) {
    const nextStatus = row.activated_at ? "active" : "pending"
    const { error } = await svc
      .from("portal_users")
      .update({ status: nextStatus })
      .eq("organization_id", organizationId)
      .eq("id", row.id)
    if (error) return jsonError("Could not restore portal access.", 500)
  }

  return NextResponse.json({ accessEnabled: true })
}
