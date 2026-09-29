import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { PORTAL_SESSION_COOKIE, PORTAL_SESSION_MAX_AGE_SEC } from "@/lib/portal/constants"
import { getPortalSessionSecret } from "@/lib/portal/env"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { redeemPortalAccessToken } from "@/lib/portal/redeem-portal-access-link"
import { getRequestMeta } from "@/lib/portal/require-portal-session"
import { signPortalToken } from "@/lib/portal/session-token"

export const runtime = "nodejs"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Exchange a one-time portal invite/magic token for an HTTP-only signed session cookie.
 * GET of `/portal/login?token=` does not call this route — scanners that only fetch the email URL
 * do not consume the credential.
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

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const redeemed = await redeemPortalAccessToken(svc, rawToken)
  if (!redeemed.ok) {
    return jsonError(redeemed.message, redeemed.status)
  }

  const { portalUser, linkKind } = redeemed
  const exp = Math.floor(Date.now() / 1000) + PORTAL_SESSION_MAX_AGE_SEC
  const sessionToken = await signPortalToken(
    {
      v: 1,
      pu: portalUser.id,
      org: portalUser.organization_id,
      cust: portalUser.customer_id,
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
    organizationId: portalUser.organization_id,
    portalUserId: portalUser.id,
    action: "portal_login",
    path: "/api/portal/access/exchange",
    metadata: { via: "access_link", link_kind: linkKind },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({
    ok: true,
    redirectTo: "/portal/dashboard",
  })
}
