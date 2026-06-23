import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { getWarmupProfile } from "@/lib/growth/warmup/warmup-repository"
import { runWarmupProgressionForProfile } from "@/lib/growth/warmup/warmup-execution"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  const { id } = await context.params
  const before = await getWarmupProfile(access.admin, id)
  if (!before) {
    return NextResponse.json({ ok: false, error: "warmup_profile_not_found" }, { status: 404 })
  }

  if (before.status === "paused") {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_paused",
        message: "Use Resume Warmup for paused profiles.",
      },
      { status: 409 },
    )
  }

  try {
    const progression = await runWarmupProgressionForProfile(access.admin, id)
    const after = await getWarmupProfile(access.admin, id)
    return NextResponse.json({
      ok: true,
      progression,
      profile: after,
      cleared_throttle: before.status === "throttled" && after?.status === "warming",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "warmup_sync_progression_failed",
        message: error instanceof Error ? error.message : "Could not sync warmup progression.",
      },
      { status: 500 },
    )
  }
}
