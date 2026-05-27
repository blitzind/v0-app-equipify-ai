import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import { fetchGrowthSequenceExecutionDashboard } from "@/lib/growth/sequence-enrollment/sequence-execution-dashboard-repository"

export const runtime = "nodejs"

const SAFE_MESSAGE = "Could not load sequence execution dashboard."

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const view = url.searchParams.get("view")

  try {
    if (view === "enrollments") {
      const dashboard = await fetchGrowthSequenceExecutionDashboard(access.admin)
      return NextResponse.json({ ok: true, dashboard })
    }

    const dashboard = await fetchGrowthSequenceSafeExecutionDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: SAFE_MESSAGE }, { status: 500 })
  }
}
