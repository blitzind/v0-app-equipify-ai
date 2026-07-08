import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import {
  GROWTH_REVENUE_QUEUE_SORT_MODES,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type RevenueQueueSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
  loadRevenueQueueDashboardPayload,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const sortParam = url.searchParams.get("sort") ?? "priority"
  const sort: RevenueQueueSortMode = GROWTH_REVENUE_QUEUE_SORT_MODES.includes(
    sortParam as RevenueQueueSortMode,
  )
    ? (sortParam as RevenueQueueSortMode)
    : "priority"
  const dashboard = await loadRevenueQueueDashboardPayload(access.admin, {
    sort,
    limit: 100,
  })

  return growthHomeNoStoreJson({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    api_bridge_marker: GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
    sort,
    sections: dashboard.sections,
    total: dashboard.total,
    queue_source: dashboard.queue_source,
  })
}
