import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchOpportunityWorkspaceDashboard } from "@/lib/growth/revenue-intelligence/opportunity-workspace-dashboard"
import { GROWTH_OPPORTUNITY_WORKSPACE_VIEWS } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const viewParam = url.searchParams.get("view")
  const view =
    viewParam && GROWTH_OPPORTUNITY_WORKSPACE_VIEWS.includes(viewParam as (typeof GROWTH_OPPORTUNITY_WORKSPACE_VIEWS)[number])
      ? (viewParam as (typeof GROWTH_OPPORTUNITY_WORKSPACE_VIEWS)[number])
      : undefined
  const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(url.searchParams.get("limit") ?? "50")

  try {
    const dashboard = await fetchOpportunityWorkspaceDashboard(access.admin, { view, limit })
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load opportunity workspace." }, { status: 500 })
  }
}
