import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getWorkspacePreferencesForUser,
  resolveEffectiveWorkspacePreferences,
  upsertWorkspacePreferencesForUser,
} from "@/lib/growth/settings/growth-workspace-settings-repository"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"
import { GROWTH_WORKSPACE_SETTINGS_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-types"

export const runtime = "nodejs"

const landingPages = GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.map((option) => option.value)

const patchSchema = z
  .object({
    defaultLandingPage: z.enum(landingPages as [string, ...string[]]).optional(),
    compactMode: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .strict()

function mapPersonalPreferences(record: Awaited<ReturnType<typeof getWorkspacePreferencesForUser>>) {
  const effective = resolveEffectiveWorkspacePreferences(record)
  return {
    defaultLandingPage: effective.defaultLandingPage,
    compactMode: effective.compactMode,
    reducedMotion: effective.reducedMotion,
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
      preferences: mapPersonalPreferences(record),
      persisted: Boolean(record),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load personal preferences."
    return growthWorkspaceSettingsJsonError("personal_preferences_load_failed", message, 500)
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
      "invalid_personal_preferences",
      parsed.error.issues[0]?.message ?? "Invalid personal preferences payload.",
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
      preferences: mapPersonalPreferences(record),
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save personal preferences."
    return growthWorkspaceSettingsJsonError("personal_preferences_save_failed", message, 500)
  }
}
