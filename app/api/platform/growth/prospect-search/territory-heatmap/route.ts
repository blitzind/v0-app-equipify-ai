import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import {
  GROWTH_TERRITORY_OPPORTUNITY_BUCKET_DIMENSIONS,
  type GrowthTerritoryOpportunityBucketDimension,
} from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import { loadTerritoryOpportunityHeatmap } from "@/lib/growth/prospect-search/territory-opportunity-heatmap-repository"

export const runtime = "nodejs"

function parseFiltersParam(raw: string | null): Partial<GrowthProspectSearchFilters> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Partial<GrowthProspectSearchFilters>
  } catch {
    return {}
  }
}

function parseBucketDimension(raw: string | null): GrowthTerritoryOpportunityBucketDimension | undefined {
  if (!raw) return undefined
  return GROWTH_TERRITORY_OPPORTUNITY_BUCKET_DIMENSIONS.includes(
    raw as GrowthTerritoryOpportunityBucketDimension,
  )
    ? (raw as GrowthTerritoryOpportunityBucketDimension)
    : undefined
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? ""
  const filters = parseFiltersParam(url.searchParams.get("filters"))
  const bucket_dimension = parseBucketDimension(url.searchParams.get("bucket"))
  const saved_search_restored = url.searchParams.get("saved") === "1"
  const discovery_mode: GrowthProspectSearchDiscoveryMode =
    url.searchParams.get("mode") === "discover_external" ? "discover_external" : "internal"

  if (discovery_mode === "discover_external") {
    return NextResponse.json({
      ok: true,
      heatmap: null,
      message: "Territory opportunity heat map uses the internal materialized index only.",
    })
  }

  const heatmap = await loadTerritoryOpportunityHeatmap(access.admin, {
    query,
    filters,
    bucket_dimension,
    saved_search_restored,
  })

  return NextResponse.json({ ok: true, heatmap })
}
