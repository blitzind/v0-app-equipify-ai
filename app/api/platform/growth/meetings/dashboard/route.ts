import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthMeetingIntelligenceDashboard } from "@/lib/growth/meeting-intelligence/meeting-intelligence-dashboard-repository"
import {
  GROWTH_MEETING_SCHEMA_SETUP_MESSAGE,
  isGrowthMeetingSchemaReady,
} from "@/lib/growth/meeting-intelligence/meeting-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMeetingSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_MEETING_SCHEMA_SETUP_MESSAGE },
      dashboard: null,
    })
  }

  const url = new URL(request.url)
  const ownerUserIdParam = url.searchParams.get("ownerUserId")
  const ownerUserId =
    ownerUserIdParam === "me"
      ? access.userId
      : ownerUserIdParam && z.string().uuid().safeParse(ownerUserIdParam).success
        ? ownerUserIdParam
        : undefined

  try {
    const dashboard = await fetchGrowthMeetingIntelligenceDashboard(access.admin, {
      ownerUserId,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, meta: { schemaReady: true }, dashboard })
  } catch {
    return NextResponse.json(
      { error: "fetch_failed", message: "Could not load meeting intelligence dashboard." },
      { status: 500 },
    )
  }
}
