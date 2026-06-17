import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_INBOX_THREAD_QUEUE_VIEWS } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import {
  getWorkspacePreferencesForUser,
  resolveEffectiveWorkspacePreferences,
  upsertWorkspacePreferencesForUser,
} from "@/lib/growth/settings/growth-workspace-settings-repository"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  GROWTH_WORKSPACE_SETTINGS_CALLS_VIEW_OPTIONS,
  GROWTH_WORKSPACE_SETTINGS_OPPORTUNITIES_TAB_OPTIONS,
} from "@/lib/growth/settings/growth-workspace-settings-options"
import { GROWTH_WORKSPACE_SETTINGS_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-types"

export const runtime = "nodejs"

const callsViews = GROWTH_WORKSPACE_SETTINGS_CALLS_VIEW_OPTIONS.map((option) => option.value)
const opportunitiesTabs = GROWTH_WORKSPACE_SETTINGS_OPPORTUNITIES_TAB_OPTIONS.map((option) => option.value)

const patchSchema = z
  .object({
    inboxDefaultFilter: z.enum(GROWTH_INBOX_THREAD_QUEUE_VIEWS).optional(),
    callsDefaultView: z.enum(callsViews as [string, ...string[]]).optional(),
    opportunitiesDefaultTab: z.enum(opportunitiesTabs as [string, ...string[]]).optional(),
  })
  .strict()

function mapDefaultViews(record: Awaited<ReturnType<typeof getWorkspacePreferencesForUser>>) {
  const effective = resolveEffectiveWorkspacePreferences(record)
  return {
    inboxDefaultFilter: effective.inboxDefaultFilter,
    callsDefaultView: effective.callsDefaultView,
    opportunitiesDefaultTab: effective.opportunitiesDefaultTab,
    updatedAt: record?.updatedAt ?? null,
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const record = await getWorkspacePreferencesForUser(access.admin, access.userId)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      preferences: mapDefaultViews(record),
      persisted: Boolean(record),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load default views."
    return growthWorkspaceSettingsJsonError("default_views_load_failed", message, 500)
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
      "invalid_default_views",
      parsed.error.issues[0]?.message ?? "Invalid default views payload.",
      400,
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return growthWorkspaceSettingsJsonError("invalid_body", "No fields to update.", 400)
  }

  try {
    const record = await upsertWorkspacePreferencesForUser(access.admin, access.userId, parsed.data)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      preferences: mapDefaultViews(record),
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save default views."
    return growthWorkspaceSettingsJsonError("default_views_save_failed", message, 500)
  }
}
