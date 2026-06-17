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
import { normalizeGrowthWorkspaceFavoriteDestinations } from "@/lib/growth/settings/growth-workspace-settings-options"
import { GROWTH_WORKSPACE_SETTINGS_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const runtime = "nodejs"

const patchSchema = z
  .object({
    sidebarCollapsed: z.boolean().optional(),
    favoriteDestinations: z.array(z.string()).optional(),
    lastVisitedRoute: z
      .string()
      .regex(new RegExp(`^${GROWTH_WORKSPACE_BASE_PATH}/`))
      .nullable()
      .optional(),
  })
  .strict()

function mapSidebarPreferences(record: Awaited<ReturnType<typeof getWorkspacePreferencesForUser>>) {
  const effective = resolveEffectiveWorkspacePreferences(record)
  return {
    sidebarCollapsed: effective.sidebarCollapsed,
    favoriteDestinations: effective.favoriteDestinations,
    lastVisitedRoute: effective.lastVisitedRoute,
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
      preferences: mapSidebarPreferences(record),
      persisted: Boolean(record),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load sidebar preferences."
    return growthWorkspaceSettingsJsonError("sidebar_preferences_load_failed", message, 500)
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
      "invalid_sidebar_preferences",
      parsed.error.issues[0]?.message ?? "Invalid sidebar preferences payload.",
      400,
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return growthWorkspaceSettingsJsonError("invalid_body", "No fields to update.", 400)
  }

  const patch = {
    ...parsed.data,
    favoriteDestinations:
      parsed.data.favoriteDestinations !== undefined
        ? normalizeGrowthWorkspaceFavoriteDestinations(parsed.data.favoriteDestinations)
        : undefined,
  }

  try {
    const record = await upsertWorkspacePreferencesForUser(access.admin, access.userId, patch)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      preferences: mapSidebarPreferences(record),
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save sidebar preferences."
    return growthWorkspaceSettingsJsonError("sidebar_preferences_save_failed", message, 500)
  }
}
