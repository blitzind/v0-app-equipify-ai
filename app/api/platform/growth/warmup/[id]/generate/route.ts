import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { generateWarmupSchedule } from "@/lib/growth/warmup/warmup-repository"
import { isGrowthWarmupFoundationSchemaReady } from "@/lib/growth/warmup/warmup-schema-health"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const profile = await generateWarmupSchedule(access.admin, id, {
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate warmup schedule."
    const status = message === "warmup_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "warmup_generate_failed", message }, { status })
  }
}
