import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { PORTAL_SESSION_COOKIE, PORTAL_SESSION_MAX_AGE_SEC } from "@/lib/portal/constants"
import { getPortalSessionSecret } from "@/lib/portal/env"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta } from "@/lib/portal/require-portal-session"
import { signPortalToken } from "@/lib/portal/session-token"
import { sha256Hex } from "@/lib/portal/token-hash"

export const runtime = "nodejs"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Exchange a one-time portal invite/magic token for an HTTP-only signed session cookie.
 */
export async function POST(request: Request) {
  const secret = getPortalSessionSecret()
  if (!secret) {
    return jsonError("Portal sign-in is not configured (missing PORTAL_SESSION_SECRET).", 503)
  }

  let body: { token?: string }
  try {
    body = (await request.json()) as { token?: string }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const rawToken = typeof body.token === "string" ? body.token.trim() : ""
  if (!rawToken) {
    return jsonError("Token is required.", 400)
  }

  const tokenHash = sha256Hex(rawToken)

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: link, error: linkErr } = await svc
    .from("portal_access_links")
    .select("id, organization_id, portal_user_id, expires_at, max_uses, use_count, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (linkErr || !link) {
    return jsonError("Invalid or expired link.", 401)
  }

  if (link.revoked_at) {
    return jsonError("This link has been revoked.", 401)
  }

  if (new Date(link.expires_at).getTime() < Date.now()) {
    return jsonError("This link has expired.", 401)
  }

  if (link.use_count >= link.max_uses) {
    return jsonError("This link has already been used.", 401)
  }

  const { data: pu, error: puErr } = await svc
    .from("portal_users")
    .select("id, organization_id, customer_id, email, display_name, status")
    .eq("id", link.portal_user_id)
    .maybeSingle()

  if (puErr || !pu) {
    return jsonError("Portal user not found.", 401)
  }

  if (pu.organization_id !== link.organization_id) {
    return jsonError("Portal session is inconsistent.", 401)
  }

  if (pu.status === "revoked") {
    return jsonError("This portal account has been disabled.", 403)
  }

  const { data: org } = await svc.from("organizations").select("status").eq("id", pu.organization_id).maybeSingle()
  if ((org as { status?: string } | null)?.status === "archived") {
    return jsonError("This workspace is no longer available.", 403)
  }

  const nowIso = new Date().toISOString()
  const nextUse = link.use_count + 1
  const { error: updErr } = await svc
    .from("portal_access_links")
    .update({
      use_count: nextUse,
      last_used_at: nowIso,
    })
    .eq("id", link.id)
    .eq("organization_id", link.organization_id)

  if (updErr) {
    return jsonError("Could not redeem link.", 500)
  }

  const statusUpdate =
    pu.status === "pending" ?
      {
        status: "active",
        activated_at: nowIso,
        last_login_at: nowIso,
        invited_at: nowIso,
      }
    : { last_login_at: nowIso }

  await svc.from("portal_users").update(statusUpdate).eq("id", pu.id).eq("organization_id", pu.organization_id)

  const exp = Math.floor(Date.now() / 1000) + PORTAL_SESSION_MAX_AGE_SEC
  const sessionToken = await signPortalToken(
    {
      v: 1,
      pu: pu.id,
      org: pu.organization_id,
      cust: pu.customer_id,
      exp,
    },
    secret,
  )

  const cookieStore = await cookies()
  cookieStore.set(PORTAL_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE_SEC,
  })

  const meta = await getRequestMeta()
  await logPortalActivity(svc, {
    organizationId: pu.organization_id,
    portalUserId: pu.id,
    action: "portal_login",
    path: "/api/portal/access/exchange",
    metadata: { via: "access_link", link_kind: "invite_or_magic" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({
    ok: true,
    redirectTo: "/portal/dashboard",
  })
}
