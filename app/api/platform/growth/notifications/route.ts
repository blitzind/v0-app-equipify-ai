import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_OPERATOR_NOTIFICATION_EVENTS } from "@/lib/growth/notifications/growth-notification-events"
import {
  GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
  type GrowthOperatorNotificationListStatus,
} from "@/lib/growth/notifications/growth-notification-persistence-types"
import { mapGrowthOperatorNotificationCenterItem } from "@/lib/growth/notifications/growth-notification-center-utils"
import { listNotifications } from "@/lib/growth/notifications/growth-notification-repository"
import { GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES } from "@/lib/growth/notifications/growth-notification-routing"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"

export const runtime = "nodejs"

const STATUS_VALUES = ["unread", "acknowledged", "dismissed", "all"] as const

function parseListStatus(value: string | null): GrowthOperatorNotificationListStatus {
  if (value && STATUS_VALUES.includes(value as (typeof STATUS_VALUES)[number])) {
    return value as GrowthOperatorNotificationListStatus
  }
  return "unread"
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const status = parseListStatus(url.searchParams.get("status"))
  const severityParam = url.searchParams.get("severity")
  const eventParam = url.searchParams.get("event") ?? url.searchParams.get("eventType")
  const recipientRoleParam = url.searchParams.get("recipientRole")

  const severityParsed =
    severityParam &&
    GROWTH_OPERATOR_NOTIFICATION_SEVERITIES.includes(
      severityParam as (typeof GROWTH_OPERATOR_NOTIFICATION_SEVERITIES)[number],
    )
      ? (severityParam as (typeof GROWTH_OPERATOR_NOTIFICATION_SEVERITIES)[number])
      : undefined

  const eventParsed =
    eventParam &&
    GROWTH_OPERATOR_NOTIFICATION_EVENTS.includes(
      eventParam as (typeof GROWTH_OPERATOR_NOTIFICATION_EVENTS)[number],
    )
      ? (eventParam as (typeof GROWTH_OPERATOR_NOTIFICATION_EVENTS)[number])
      : undefined

  const recipientRoleParsed =
    recipientRoleParam &&
    GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES.includes(
      recipientRoleParam as (typeof GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES)[number],
    )
      ? (recipientRoleParam as (typeof GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES)[number])
      : undefined

  const limitParam = url.searchParams.get("limit")
  const offsetParam = url.searchParams.get("offset")
  const limit = limitParam ? z.coerce.number().int().min(1).max(100).parse(limitParam) : 25
  const offset = offsetParam ? z.coerce.number().int().min(0).parse(offsetParam) : 0

  try {
    const result = await listNotifications(access.admin, {
      recipientUserId: access.userId,
      includePlatformAdminPool: true,
      recipientRole: recipientRoleParsed,
      eventType: eventParsed,
      severity: severityParsed,
      status,
      limit,
      offset,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
      items: result.items.map(mapGrowthOperatorNotificationCenterItem),
      total: result.total,
      hasMore: result.hasMore,
      offset,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load operator notifications."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
