import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchLiveCoachingTrendsPayload } from "@/lib/growth/realtime/live-coaching/coaching-trends-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const range = url.searchParams.get("range")
  const provider = url.searchParams.get("provider")
  const risk = url.searchParams.get("risk")

  try {
    const trends = await fetchLiveCoachingTrendsPayload(access.admin, {
      rangeDays: range,
      provider,
      risk,
    })
    return NextResponse.json({ ok: true, trends })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message: "Could not load coaching trends." }, { status: 500 })
  }
}
