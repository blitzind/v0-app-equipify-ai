import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadGrowthProspectRecommendations } from "@/lib/growth/prospect-discovery/prospect-recommendation-repository"
import {
  PROSPECT_RECOMMENDATION_FILTERS,
  PROSPECT_RECOMMENDATION_SORT_FIELDS,
  type ProspectRecommendationFilter,
  type ProspectRecommendationSortField,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"

export const runtime = "nodejs"
export const maxDuration = 120

function parseFilter(value: string | null): ProspectRecommendationFilter | null {
  if (!value) return null
  return PROSPECT_RECOMMENDATION_FILTERS.includes(value as ProspectRecommendationFilter)
    ? (value as ProspectRecommendationFilter)
    : null
}

function parseSort(value: string | null): ProspectRecommendationSortField {
  if (value && PROSPECT_RECOMMENDATION_SORT_FIELDS.includes(value as ProspectRecommendationSortField)) {
    return value as ProspectRecommendationSortField
  }
  return "priority"
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const filter = parseFilter(url.searchParams.get("filter"))
  const sort = parseSort(url.searchParams.get("sort"))
  const limit = Number(url.searchParams.get("limit") ?? "50")
  const execution_run_id = url.searchParams.get("execution_run_id")
  const ensure = url.searchParams.get("ensure") === "true"

  try {
    const recommendations = await loadGrowthProspectRecommendations(access.admin, {
      execution_run_id,
      filter,
      sort,
      limit: Number.isFinite(limit) ? limit : 50,
      ensure_for_run: ensure && Boolean(execution_run_id),
    })

    return NextResponse.json({
      ok: true,
      recommendations,
      enrollment_enabled: false,
      outreach_enabled: false,
      requires_human_approval: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
