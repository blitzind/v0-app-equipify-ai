import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { sha256Hex } from "@/lib/portal/token-hash"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const INVITE_ROLES = new Set(["owner", "admin", "manager"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Staff-only: create or refresh a portal user and return a one-time invite URL for the customer.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid organization.", 400)
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
  if (!INVITE_ROLES.has(role)) {
    return jsonError("Only owners, admins, and managers can invite portal users.", 403)
  }

  let body: { customerId?: string; email?: string; displayName?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null

  if (!UUID_RE.test(customerId)) {
    return jsonError("Invalid customer id.", 400)
  }
  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required.", 400)
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: cust, error: cErr } = await svc
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .is("archived_at", null)
    .maybeSingle()

  if (cErr || !cust) {
    return jsonError("Customer not found for this organization.", 404)
  }

  const { data: existing } = await svc
    .from("portal_users")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle()

  if ((existing as { status?: string } | null)?.status === "revoked") {
    return jsonError("This portal email was revoked. Restore access before sending a new link.", 409)
  }

  const nowIso = new Date().toISOString()
  let portalUserId = (existing as { id?: string } | null)?.id

  if (!portalUserId) {
    const { data: inserted, error: insErr } = await svc
      .from("portal_users")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        email,
        display_name: displayName,
        status: "pending",
        invited_at: nowIso,
      })
      .select("id")
      .single()

    if (insErr || !inserted) {
      return jsonError("Could not create portal user.", 500)
    }
    portalUserId = inserted.id as string
  } else {
    await svc
      .from("portal_users")
      .update({
        customer_id: customerId,
        display_name: displayName ?? undefined,
        invited_at: nowIso,
      })
      .eq("organization_id", organizationId)
      .eq("id", portalUserId)
  }

  const rawToken = Buffer.from(randomBytes(32)).toString("base64url")
  const tokenHash = sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const { error: linkErr } = await svc.from("portal_access_links").insert({
    organization_id: organizationId,
    portal_user_id: portalUserId,
    token_hash: tokenHash,
    kind: "invite",
    expires_at: expiresAt,
    max_uses: 1,
    use_count: 0,
  })

  if (linkErr) {
    return jsonError("Could not create access link.", 500)
  }

  const origin =
    request.headers.get("origin")?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    new URL(request.url).origin

  const inviteUrl = `${origin.replace(/\/$/, "")}/portal/login?token=${encodeURIComponent(rawToken)}`

  return NextResponse.json({
    inviteUrl,
    expiresAt,
    portalUserId,
  })
}
