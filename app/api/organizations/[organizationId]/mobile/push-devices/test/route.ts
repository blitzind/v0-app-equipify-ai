import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { sendTechnicianPushNotification } from "@/lib/push/send-technician-push.server"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * POST — send a test push to the signed-in user's registered devices (QA only).
 * Requires EXPO_ACCESS_TOKEN and EQUIPIFY_PUSH_LIVE_SEND on the server.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid workspace." }, { status: 400 })
  }

  const session = await requireOrgMemberSession(organizationId)
  if ("error" in session) {
    return session.error
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "unavailable", message: "Push delivery is not configured on this server." },
      { status: 503 },
    )
  }

  const bucket = `test:${Date.now()}`
  const result = await sendTechnicianPushNotification(admin, {
    alertType: "work_assigned",
    organizationId,
    recipientUserId: session.userId,
    workOrderTitle: "Equipify test alert",
    customerName: "Equipify",
    idempotencyBucket: bucket,
    createdBy: session.userId,
  })

  return NextResponse.json({ ok: true, result })
}
