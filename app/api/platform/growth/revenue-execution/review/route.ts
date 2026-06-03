import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchOpportunityReviewContext } from "@/lib/growth/revenue-execution/opportunity-review-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const recommendationId = new URL(request.url).searchParams.get("recommendationId")
  if (!recommendationId) {
    return NextResponse.json({ error: "missing_recommendation_id" }, { status: 400 })
  }

  try {
    const context = await fetchOpportunityReviewContext(access.admin, recommendationId)
    if (!context) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, context })
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
