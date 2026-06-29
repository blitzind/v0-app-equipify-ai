import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAidenDailyBriefing } from "@/lib/growth/aiden/aiden-briefing-repository"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const briefing = await fetchAidenDailyBriefing(access.admin, {
      operatorEmail: access.userEmail,
      actorUserId: access.userId,
    })
    return growthHomeNoStoreJson({ ok: true, briefing })
  } catch (error) {
    return growthHomeNoStoreJson(
      {
        error: "aiden_briefing_failed",
        message: error instanceof Error ? error.message : "Could not load Aiden briefing.",
      },
      { status: 500 },
    )
  }
}
