import { NextResponse } from "next/server"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listCapturedGrowthLeads } from "@/lib/growth/captured-leads/captured-lead-repository"
import {
  GROWTH_CAPTURED_LEAD_FILTERS,
  GROWTH_CAPTURED_LEADS_QA_MARKER,
  type GrowthCapturedLeadFilter,
} from "@/lib/growth/captured-leads/captured-lead-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const filterParam = url.searchParams.get("filter") ?? "all"
  const filter = GROWTH_CAPTURED_LEAD_FILTERS.includes(filterParam as GrowthCapturedLeadFilter)
    ? (filterParam as GrowthCapturedLeadFilter)
    : "all"

  try {
    const { rows, filter_counts } = await listCapturedGrowthLeads(access.admin, { filter })

    logGrowthEngine("captured_leads_api_list", {
      count: rows.length,
      filter,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_CAPTURED_LEADS_QA_MARKER,
      rows,
      filter,
      filter_counts,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}
