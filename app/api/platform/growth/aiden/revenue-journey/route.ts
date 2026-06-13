import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAidenRevenueJourneyTracker } from "@/lib/growth/aiden/aiden-revenue-journey-tracker"

export async function GET(request: Request): Promise<NextResponse> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const cohortId = url.searchParams.get("cohort_id")
  const limit = Number(url.searchParams.get("limit") ?? "25")

  try {
    const tracker = await fetchAidenRevenueJourneyTracker(access.admin, {
      cohortId,
      limit: Number.isFinite(limit) ? limit : 25,
    })
    return NextResponse.json({ ok: true, tracker })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "aiden_revenue_journey_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
