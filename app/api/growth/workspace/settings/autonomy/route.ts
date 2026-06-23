import { NextResponse } from "next/server"
import {
  loadGrowthAutonomySettingsViewModel,
  patchGrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import { validateGrowthAutonomySettingsPatch } from "@/lib/growth/autonomy/growth-autonomy-settings-patch"
import { GROWTH_AUTONOMY_QA_MARKER } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError(
      "organization_missing",
      "Growth organization is not configured for autonomy settings.",
      503,
    )
  }

  try {
    const viewModel = await loadGrowthAutonomySettingsViewModel(access.admin, access.organizationId)
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      readOnly: false,
      viewModel,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load autonomy settings."
    return growthWorkspaceSettingsJsonError("autonomy_settings_load_failed", message, 500)
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError(
      "organization_missing",
      "Growth organization is not configured for autonomy settings.",
      503,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return growthWorkspaceSettingsJsonError("invalid_json", "Request body must be JSON.", 400)
  }

  const validated = validateGrowthAutonomySettingsPatch(body)
  if (!validated.ok) {
    return growthWorkspaceSettingsJsonError("invalid_autonomy_settings", validated.error, 400)
  }

  try {
    const viewModel = await patchGrowthAutonomySettings(access.admin, {
      organizationId: access.organizationId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      patch: validated.patch,
    })
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      readOnly: false,
      viewModel,
      persisted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save autonomy settings."
    return growthWorkspaceSettingsJsonError("autonomy_settings_save_failed", message, 500)
  }
}
