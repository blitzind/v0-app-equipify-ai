import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  acknowledgeGrowthNotificationWithTimeline,
  completeGrowthNotificationWithTimeline,
} from "@/lib/growth/notifications/emit-growth-notification"
import { fetchActiveGrowthNotificationByHash } from "@/lib/growth/notifications/notification-repository"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z.enum(["acknowledge", "complete"]),
})

async function fetchNotificationById(admin: Parameters<typeof fetchActiveGrowthNotificationByHash>[0], id: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("notifications")
    .select(
      "id, org_id, owner_user_id, lead_id, opportunity_id, notification_type, severity, title, body, metadata, created_at, acknowledged_at, completed_at, expires_at, source_system, source_id, deterministic_hash, priority_score, action_url, collapse_count",
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    orgId: data.org_id as string | null,
    ownerUserId: data.owner_user_id as string | null,
    leadId: data.lead_id as string | null,
    opportunityId: data.opportunity_id as string | null,
    notificationType: data.notification_type as import("@/lib/growth/notifications/notification-types").GrowthNotificationType,
    severity: data.severity as import("@/lib/growth/notifications/notification-types").GrowthNotificationSeverity,
    title: data.title as string,
    body: data.body as string,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    createdAt: data.created_at as string,
    acknowledgedAt: data.acknowledged_at as string | null,
    completedAt: data.completed_at as string | null,
    expiresAt: data.expires_at as string | null,
    sourceSystem: data.source_system as import("@/lib/growth/notifications/notification-types").GrowthNotificationSourceSystem,
    sourceId: data.source_id as string | null,
    deterministicHash: data.deterministic_hash as string,
    priorityScore: data.priority_score as number,
    actionUrl: data.action_url as string | null,
    collapseCount: data.collapse_count as number,
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { notificationId } = await context.params
  if (!z.string().uuid().safeParse(notificationId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Notification id must be a UUID." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid notification action." }, { status: 400 })
  }

  try {
    const existing = await fetchNotificationById(access.admin, notificationId)
    if (!existing || existing.completedAt) {
      return NextResponse.json({ error: "not_found", message: "Notification not found or already closed." }, { status: 404 })
    }

    const notification =
      parsed.data.action === "acknowledge"
        ? await acknowledgeGrowthNotificationWithTimeline(access.admin, existing, {
            userId: access.userId,
            email: access.userEmail,
          })
        : await completeGrowthNotificationWithTimeline(access.admin, existing, {
            userId: access.userId,
            email: access.userEmail,
          })

    if (!notification) {
      return NextResponse.json({ error: "update_failed", message: "Could not update notification." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, notification })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update notification."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
