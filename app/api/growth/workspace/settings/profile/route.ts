import { NextResponse } from "next/server"
import { z } from "zod"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"
import {
  loadGrowthWorkspaceSettingsProfile,
  patchGrowthWorkspaceSettingsProfile,
} from "@/lib/growth/settings/growth-workspace-profile-service"
import { GROWTH_WORKSPACE_SETTINGS_QA_MARKER } from "@/lib/growth/settings/growth-workspace-settings-types"
import { GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"

export const runtime = "nodejs"

const patchSchema = z
  .object({
    displayName: z.string().max(200).optional(),
    jobTitle: z.string().max(200).optional(),
    timezone: z.enum(GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS).optional(),
    avatarUrl: z.string().max(2048).nullable().optional(),
  })
  .strict()

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  try {
    const profile = await loadGrowthWorkspaceSettingsProfile(access.admin, access.userId, access.userEmail)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      profile,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load profile settings."
    return growthWorkspaceSettingsJsonError("profile_load_failed", message, 500)
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
      "invalid_profile",
      parsed.error.issues[0]?.message ?? "Invalid profile payload.",
      400,
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return growthWorkspaceSettingsJsonError("invalid_body", "No fields to update.", 400)
  }

  try {
    const profile = await patchGrowthWorkspaceSettingsProfile(
      access.admin,
      access.userId,
      access.userEmail,
      parsed.data,
    )
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_WORKSPACE_SETTINGS_QA_MARKER,
      profile,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save profile settings."
    return growthWorkspaceSettingsJsonError("profile_save_failed", message, 500)
  }
}
