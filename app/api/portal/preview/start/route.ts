import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { PORTAL_SESSION_COOKIE, PORTAL_SESSION_MAX_AGE_SEC } from "@/lib/portal/constants"
import { getPortalSessionSecret } from "@/lib/portal/env"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta } from "@/lib/portal/require-portal-session"
import { signPortalToken } from "@/lib/portal/session-token"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Matches portal-invites: staff who can manage portal users may preview. */
const PREVIEW_BRIDGE_ROLES = new Set(["owner", "admin", "manager"])

function portalLoginUrl(request: NextRequest, extra: Record<string, string> = {}) {
  const u = new URL("/portal/login", request.url)
  for (const [k, v] of Object.entries(extra)) {
    u.searchParams.set(k, v)
  }
  return u
}

/**
 * Staff preview bridge (GET): verifies dashboard Supabase session + org membership,
 * then mints a signed portal HTTP-only cookie **only** when a `portal_users` row
 * exists for the same email as the staff account in the selected workspace.
 *
 * - Does **not** put secrets or tokens in the URL (cookie set via redirect response).
 * - If no linked portal user → redirects to `/portal/login` with `next` preserved.
 * - If portal env missing → `/portal/login?error=misconfigured` (existing UX).
 *
 * Open from Settings → Customer Portal via `window.open` (same-site cookies).
 */
export async function GET(request: NextRequest) {
  const secret = getPortalSessionSecret()
  if (!secret) {
    return NextResponse.redirect(portalLoginUrl(request, { error: "misconfigured" }))
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        notice: "invalid_preview",
      }),
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email?.trim()) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", "/settings/portal")
    return NextResponse.redirect(login)
  }

  const emailLower = user.email.trim().toLowerCase()

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  const role = (mem as { role?: string } | null)?.role ?? ""
  if (!PREVIEW_BRIDGE_ROLES.has(role)) {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        error: "preview_forbidden",
      }),
    )
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.redirect(portalLoginUrl(request, { error: "misconfigured" }))
  }

  const { data: pu, error: puErr } = await svc
    .from("portal_users")
    .select("id, organization_id, customer_id, email, display_name, status")
    .eq("organization_id", organizationId)
    .eq("email", emailLower)
    .maybeSingle()

  if (puErr || !pu) {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        notice: "no_staff_portal",
      }),
    )
  }

  if (pu.status === "revoked") {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        notice: "portal_revoked",
      }),
    )
  }

  const { data: org } = await svc.from("organizations").select("status").eq("id", organizationId).maybeSingle()
  if ((org as { status?: string } | null)?.status === "archived") {
    return NextResponse.redirect(
      portalLoginUrl(request, {
        next: "/portal/dashboard",
        notice: "org_archived",
      }),
    )
  }

  const nowIso = new Date().toISOString()
  const statusUpdate =
    pu.status === "pending"
      ? {
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

  const dashboard = new URL("/portal/dashboard", request.url)
  const res = NextResponse.redirect(dashboard)
  res.cookies.set(PORTAL_SESSION_COOKIE, sessionToken, {
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
    action: "portal_staff_preview",
    path: "/api/portal/preview/start",
    metadata: {
      via: "staff_preview_bridge",
      staff_user_id: user.id,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return res
}
