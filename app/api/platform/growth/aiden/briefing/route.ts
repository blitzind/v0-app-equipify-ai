import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAidenDailyBriefing } from "@/lib/growth/aiden/aiden-briefing-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const briefing = await fetchAidenDailyBriefing(access.admin, {
      operatorEmail: access.userEmail,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, briefing })
  } catch (error) {
    return NextResponse.json(
      {
        error: "aiden_briefing_failed",
        message: error instanceof Error ? error.message : "Could not load Aiden briefing.",
      },
      { status: 500 },
    )
  }
}
