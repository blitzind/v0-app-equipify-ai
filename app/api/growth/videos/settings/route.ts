import { NextResponse } from "next/server"
import {
  loadGrowthVideoSettings,
  patchGrowthVideoSettings,
} from "@/lib/growth/videos/growth-video-settings-service"
import { growthVideoSettingsPatchSchema } from "@/lib/growth/videos/growth-video-settings-validation"
import { GROWTH_VIDEO_SETTINGS_QA_MARKER } from "@/lib/growth/videos/growth-video-settings-types"
import { growthVideoSafetyJson, mapGrowthVideoApiError } from "@/lib/growth/videos/growth-video-api-utils"
import { requireGrowthVideoPlatformAccess } from "@/lib/growth/videos/growth-video-platform-access"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await loadGrowthVideoSettings(access.admin, access.organizationId)
    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        settings,
        qa_marker: GROWTH_VIDEO_SETTINGS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthVideoPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthVideoSettingsPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  if (!parsed.data.branding && !parsed.data.recording_defaults) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "No editable fields provided." }, { status: 400 })
  }

  try {
    const settings = await patchGrowthVideoSettings(access.admin, access.organizationId, parsed.data)
    return NextResponse.json(
      growthVideoSafetyJson({
        ok: true,
        settings,
        persisted: true,
        qa_marker: GROWTH_VIDEO_SETTINGS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthVideoApiError(error)
  }
}
