import { NextResponse } from "next/server"
import { z } from "zod"
import { UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-shared"
import { getServiceRoleOrNull } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { requireOrgMemberSession, requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  fetchOrganizationNotificationSettingsBundle,
  looksLikeMissingNotificationTablesError,
  upsertOrganizationDigestSettings,
  upsertOrganizationNotificationPreferences,
  type DigestSettingsDto,
  type NotificationPreferenceDto,
  type OrganizationNotificationSettingsBundle,
} from "@/lib/notifications/organization-notification-preferences-repository"
import { WORKSPACE_ALERT_TYPES, isWorkspaceAlertType } from "@/lib/notifications/workspace-alert-registry"

export const runtime = "nodejs"
/** Avoid edge/CDN caching so clients always see fresh workspace notification prefs after writes. */
export const dynamic = "force-dynamic"

const LOCAL_HM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

function serializeBundle(bundle: OrganizationNotificationSettingsBundle) {
  return {
    preferences: bundle.preferences.map((p) => ({
      alertType: p.alertType,
      inAppEnabled: p.inAppEnabled,
      emailEnabled: p.emailEnabled,
      smsEnabled: p.smsEnabled,
    })),
    digest: {
      digestEnabled: bundle.digest.digestEnabled,
      digestFrequency: bundle.digest.digestFrequency,
      digestTimeLocal: bundle.digest.digestTimeLocal,
      quietHoursEnabled: bundle.digest.quietHoursEnabled,
      quietHoursStartLocal: bundle.digest.quietHoursStartLocal,
      quietHoursEndLocal: bundle.digest.quietHoursEndLocal,
    },
  }
}

function notificationPreferencesJsonResponse(bundle: OrganizationNotificationSettingsBundle, persistenceReady: boolean) {
  return {
    ...serializeBundle(bundle),
    meta: { persistenceReady },
  }
}

const PreferenceItemSchema = z.object({
  alertType: z.string(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean().optional(),
})

const DigestPatchSchema = z.object({
  digestEnabled: z.boolean(),
  digestFrequency: z.enum(["daily", "weekly"]),
  digestTimeLocal: z.string().regex(LOCAL_HM, "digestTimeLocal must be HH:MM (local)."),
  quietHoursEnabled: z.boolean(),
  quietHoursStartLocal: z
    .string()
    .regex(LOCAL_HM, "quietHoursStartLocal must be HH:MM (local).")
    .nullable(),
  quietHoursEndLocal: z
    .string()
    .regex(LOCAL_HM, "quietHoursEndLocal must be HH:MM (local).")
    .nullable(),
})

const PatchBodySchema = z
  .object({
    preferences: z.array(PreferenceItemSchema).optional(),
    digest: DigestPatchSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.preferences === undefined && body.digest === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide preferences and/or digest." })
    }
    if (body.preferences) {
      if (body.preferences.length !== WORKSPACE_ALERT_TYPES.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `preferences must include exactly ${WORKSPACE_ALERT_TYPES.length} alert rows.`,
          path: ["preferences"],
        })
      }
      const unknown = body.preferences.find((p) => !isWorkspaceAlertType(p.alertType))
      if (unknown) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown alertType.",
          path: ["preferences"],
        })
      }
      const distinct = new Set(body.preferences.map((p) => p.alertType))
      if (body.preferences.length === WORKSPACE_ALERT_TYPES.length && distinct.size !== WORKSPACE_ALERT_TYPES.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "preferences must include every alert type exactly once.",
          path: ["preferences"],
        })
      }
      if (body.preferences.some((p) => p.smsEnabled === true)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMS alerts are not active yet.",
          path: ["preferences"],
        })
      }
      for (const t of WORKSPACE_ALERT_TYPES) {
        if (!body.preferences.some((p) => p.alertType === t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "preferences must include every alert type exactly once.",
            path: ["preferences"],
          })
          break
        }
      }
    }
    if (body.digest?.quietHoursEnabled) {
      if (!body.digest.quietHoursStartLocal || !body.digest.quietHoursEndLocal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Quiet hours require start and end times.",
          path: ["digest", "quietHoursStartLocal"],
        })
      }
    }
  })

function orderPreferences(parsed: z.infer<typeof PreferenceItemSchema>[]): NotificationPreferenceDto[] {
  const byType = new Map(parsed.map((p) => [p.alertType, p]))
  return WORKSPACE_ALERT_TYPES.map((t) => {
    const row = byType.get(t)
    return {
      alertType: t,
      inAppEnabled: Boolean(row?.inAppEnabled),
      emailEnabled: Boolean(row?.emailEnabled),
      smsEnabled: false,
    }
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const loaded = await fetchOrganizationNotificationSettingsBundle(gate.supabase, organizationId)
  if (loaded.error || !loaded.data) {
    console.error("[notification-preferences GET]", {
      organizationId,
      message: loaded.error?.message ?? "no data",
    })
    return NextResponse.json(
      { error: "query_failed", message: "Could not load notification settings." },
      { status: 500 },
    )
  }

  return NextResponse.json(notificationPreferencesJsonResponse(loaded.data, loaded.persistenceReady), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  let body: z.infer<typeof PatchBodySchema>
  try {
    const raw = await request.json().catch(() => ({}))
    body = PatchBodySchema.parse(raw)
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.warn("[notification-preferences PATCH] validation failed", {
        issues: e.issues.map((i) => ({ path: i.path, code: i.code })),
      })
      return NextResponse.json(
        { error: "bad_request", message: "Check your notification settings and try again." },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 })
  }

  if (body.preferences) {
    const ordered = orderPreferences(body.preferences)
    const up = await upsertOrganizationNotificationPreferences(svc, organizationId, ordered)
    if (up.error) {
      console.error("[notification-preferences PATCH] preferences upsert", {
        organizationId,
        code: up.error.code,
        message: up.error.message,
      })
      if (looksLikeMissingNotificationTablesError(up.error)) {
        return NextResponse.json(
          {
            error: "not_configured",
            message:
              "Notification preference storage is not set up on this server yet. Ask an administrator to apply the latest database migration, then try again.",
          },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: "update_failed", message: "Could not save notification preferences." },
        { status: 500 },
      )
    }
    console.info("[notification-preferences PATCH] preferences_upsert_ok", {
      organizationId,
      rowCount: ordered.length,
    })
  }

  if (body.digest) {
    const digest: DigestSettingsDto = {
      digestEnabled: body.digest.digestEnabled,
      digestFrequency: body.digest.digestFrequency,
      digestTimeLocal: body.digest.digestTimeLocal,
      quietHoursEnabled: body.digest.quietHoursEnabled,
      quietHoursStartLocal: body.digest.quietHoursEnabled ? body.digest.quietHoursStartLocal : null,
      quietHoursEndLocal: body.digest.quietHoursEnabled ? body.digest.quietHoursEndLocal : null,
    }
    const upD = await upsertOrganizationDigestSettings(svc, organizationId, digest)
    if (upD.error) {
      console.error("[notification-preferences PATCH] digest upsert", {
        organizationId,
        code: upD.error.code,
        message: upD.error.message,
      })
      if (looksLikeMissingNotificationTablesError(upD.error)) {
        return NextResponse.json(
          {
            error: "not_configured",
            message:
              "Notification preference storage is not set up on this server yet. Ask an administrator to apply the latest database migration, then try again.",
          },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: "update_failed", message: "Could not save digest settings." },
        { status: 500 },
      )
    }
    console.info("[notification-preferences PATCH] digest_upsert_ok", { organizationId })
  }

  // Reload with service role so the response reflects rows just written (avoids replica / session read lag vs user JWT).
  const loaded = await fetchOrganizationNotificationSettingsBundle(svc, organizationId)
  if (loaded.error || !loaded.data) {
    console.error("[notification-preferences PATCH] reload after save", {
      organizationId,
      message: loaded.error?.message ?? "no data",
    })
    return NextResponse.json(
      { error: "query_failed", message: "Saved, but settings could not be reloaded." },
      { status: 500 },
    )
  }

  return NextResponse.json(notificationPreferencesJsonResponse(loaded.data, loaded.persistenceReady), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  })
}
