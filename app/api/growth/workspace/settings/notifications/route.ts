import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getPreferencesForUser,
  resolveEffectivePreferences,
  upsertPreferencesForUser,
} from "@/lib/growth/notifications/growth-notification-preferences-repository"
import { GROWTH_OPERATOR_NOTIFICATION_EVENTS } from "@/lib/growth/notifications/growth-notification-events"
import { resolveEffectiveGrowthOperatorNotificationPreferences } from "@/lib/growth/notifications/growth-notification-preferences-utils"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { GROWTH_WORKSPACE_SETTINGS_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-types"

export const runtime = "nodejs"

const patchSchema = z
  .object({
    browserPushEnabled: z.boolean().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    minimumSeverity: z.enum(GROWTH_OPERATOR_NOTIFICATION_SEVERITIES).optional(),
    disabledEventTypes: z.array(z.enum(GROWTH_OPERATOR_NOTIFICATION_EVENTS)).optional(),
  })
  .strict()

function mapNotificationResponse(record: Awaited<ReturnType<typeof getPreferencesForUser>>) {
  const effective = resolveEffectiveGrowthOperatorNotificationPreferences(record)
  return {
    ...effective,
    id: record?.id ?? null,
    createdAt: record?.createdAt ?? null,
    updatedAt: record?.updatedAt ?? null,
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const [record, effective] = await Promise.all([
      getPreferencesForUser(access.admin, access.userId),
      resolveEffectivePreferences(access.admin, access.userId),
    ])

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      preferences: mapNotificationResponse(record),
      effective,
      persisted: Boolean(record),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load notification settings."
    return growthWorkspaceSettingsJsonError("notifications_load_failed", message, 500)
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return growthWorkspaceSettingsJsonError("invalid_json", "Request body must be JSON.", 400)
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return growthWorkspaceSettingsJsonError(
      "invalid_notifications",
      parsed.error.issues[0]?.message ?? "Invalid notifications payload.",
      400,
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return growthWorkspaceSettingsJsonError("invalid_body", "No fields to update.", 400)
  }

  try {
    const record = await upsertPreferencesForUser(access.admin, access.userId, parsed.data)
    const effective = resolveEffectiveGrowthOperatorNotificationPreferences(record)

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      preferences: mapNotificationResponse(record),
      effective,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save notification settings."
    return growthWorkspaceSettingsJsonError("notifications_save_failed", message, 500)
  }
}
