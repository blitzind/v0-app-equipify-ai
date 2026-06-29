import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import { loadLeadInbox } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { buildLeadInboxDashboardSections } from "@/lib/growth/lead-operator-workspace/lead-inbox-dashboard"
import {
  GROWTH_LEAD_INBOX_SORT_MODES,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type GrowthLeadInboxSortMode,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const sortParam = url.searchParams.get("sort") ?? "priority"
  const sort: GrowthLeadInboxSortMode = GROWTH_LEAD_INBOX_SORT_MODES.includes(
    sortParam as GrowthLeadInboxSortMode,
  )
    ? (sortParam as GrowthLeadInboxSortMode)
    : "priority"

  const result = await loadLeadInbox(access.admin, { limit: 100 })
  const sections = buildLeadInboxDashboardSections(result.items, sort)

  return growthHomeNoStoreJson({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    sort,
    sections,
    total: result.total,
  })
}
