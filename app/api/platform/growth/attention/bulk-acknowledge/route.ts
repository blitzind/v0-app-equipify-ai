import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { bulkAcknowledgeGrowthNotifications } from "@/lib/growth/notifications/notification-repository"

export const runtime = "nodejs"

const BodySchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide notificationIds array." }, { status: 400 })
  }

  try {
    const acknowledged = await bulkAcknowledgeGrowthNotifications(access.admin, parsed.data.notificationIds)
    return NextResponse.json({ ok: true, acknowledged })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bulk acknowledge failed."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
