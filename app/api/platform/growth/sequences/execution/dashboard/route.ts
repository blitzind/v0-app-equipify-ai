import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSequenceExecutionDashboard } from "@/lib/growth/sequence-enrollment/sequence-execution-dashboard-repository"

export const runtime = "nodejs"

const SAFE_MESSAGE = "Could not load sequence execution dashboard."

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthSequenceExecutionDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: SAFE_MESSAGE }, { status: 500 })
  }
}
