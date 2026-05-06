import { NextResponse } from "next/server"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

type Body = {
  message?: string
  equipmentId?: string | null
  urgency?: string | null
}

export async function POST(request: Request) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Please describe the issue (at least a few words)." }, { status: 400 })
  }

  if (message.length > 8000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 })
  }

  const { svc, portalUser } = ctx

  if (body.equipmentId) {
    const { data: eq } = await svc
      .from("equipment")
      .select("id")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("id", body.equipmentId)
      .eq("is_archived", false)
      .maybeSingle()
    if (!eq) {
      return NextResponse.json({ error: "Equipment not found." }, { status: 400 })
    }
  }

  const meta = await getRequestMeta()
  await logPortalActivity(svc, {
    organizationId: portalUser.organization_id,
    portalUserId: portalUser.id,
    action: "service_request_submitted",
    path: "/api/portal/service-requests",
    metadata: {
      message,
      equipmentId: body.equipmentId ?? null,
      urgency: body.urgency ?? null,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({
    ok: true,
    message: "Your request was submitted. The service team will follow up shortly.",
  })
}
