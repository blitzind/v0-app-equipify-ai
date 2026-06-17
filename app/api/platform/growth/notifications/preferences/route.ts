import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_OPERATOR_NOTIFICATION_EVENTS } from "@/lib/growth/notifications/growth-notification-events"
import {
  getPreferencesForUser,
  resolveEffectivePreferences,
  upsertPreferencesForUser,
} from "@/lib/growth/notifications/growth-notification-preferences-repository"
import { GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER } from "@/lib/growth/notifications/growth-notification-preferences-types"
import {
  isGrowthOperatorNotificationSeverity,
  resolveEffectiveGrowthOperatorNotificationPreferences,
} from "@/lib/growth/notifications/growth-notification-preferences-utils"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"

export const runtime = "nodejs"

const patchSchema = z
  .object({
    inAppEnabled: z.boolean().optional(),
    browserPushEnabled: z.boolean().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
    minimumSeverity: z.enum(GROWTH_OPERATOR_NOTIFICATION_SEVERITIES).optional(),
    disabledEventTypes: z.array(z.enum(GROWTH_OPERATOR_NOTIFICATION_EVENTS)).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
    quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
    quietHoursTimezone: z.string().min(1).nullable().optional(),
  })
  .strict()

function mapPreferencesResponse(
  record: Awaited<ReturnType<typeof getPreferencesForUser>>,
) {
  const effective = resolveEffectiveGrowthOperatorNotificationPreferences(record)
  return {
    id: record?.id ?? null,
    organizationId: record?.organizationId ?? null,
    userId: record?.userId ?? null,
    ...effective,
    createdAt: record?.createdAt ?? null,
    updatedAt: record?.updatedAt ?? null,
  }
}

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const [record, effective] = await Promise.all([
      getPreferencesForUser(access.admin, access.userId),
      resolveEffectivePreferences(access.admin, access.userId),
    ])

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
      preferences: mapPreferencesResponse(record),
      effective,
      persisted: Boolean(record),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load notification preferences."
    return NextResponse.json({ error: "preferences_load_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_preferences", message: parsed.error.issues[0]?.message ?? "Invalid preferences payload." },
      { status: 400 },
    )
  }

  if (
    parsed.data.minimumSeverity &&
    !isGrowthOperatorNotificationSeverity(parsed.data.minimumSeverity)
  ) {
    return NextResponse.json(
      { error: "invalid_minimum_severity", message: "minimumSeverity is invalid." },
      { status: 400 },
    )
  }

  try {
    const record = await upsertPreferencesForUser(access.admin, access.userId, parsed.data)
    const effective = resolveEffectiveGrowthOperatorNotificationPreferences(record)

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
      preferences: mapPreferencesResponse(record),
      effective,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save notification preferences."
    return NextResponse.json({ error: "preferences_save_failed", message }, { status: 500 })
  }
}
