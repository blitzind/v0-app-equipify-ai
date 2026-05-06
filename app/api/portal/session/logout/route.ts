import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { PORTAL_SESSION_COOKIE } from "@/lib/portal/constants"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function POST() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) {
    const cookieStore = await cookies()
    cookieStore.delete(PORTAL_SESSION_COOKIE)
    return NextResponse.json({ ok: true })
  }

  const meta = await getRequestMeta()
  await logPortalActivity(ctx.svc, {
    organizationId: ctx.portalUser.organization_id,
    portalUserId: ctx.portalUser.id,
    action: "portal_logout",
    path: "/api/portal/session/logout",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  const cookieStore = await cookies()
  cookieStore.delete(PORTAL_SESSION_COOKIE)

  return NextResponse.json({ ok: true })
}
