import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import { fetchGrowthSequenceExecutionDashboard } from "@/lib/growth/sequence-enrollment/sequence-execution-dashboard-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SAFE_MESSAGE = "Could not load sequence execution dashboard."

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const view = url.searchParams.get("view")

  try {
    if (view === "enrollments") {
      const dashboard = await fetchGrowthSequenceExecutionDashboard(access.admin)
      return growthHomeNoStoreJson({ ok: true, dashboard })
    }

    const dashboard = await fetchGrowthSequenceSafeExecutionDashboard(access.admin)
    return growthHomeNoStoreJson({ ok: true, dashboard })
  } catch {
    return growthHomeNoStoreJson({ error: "fetch_failed", message: SAFE_MESSAGE }, { status: 500 })
  }
}
