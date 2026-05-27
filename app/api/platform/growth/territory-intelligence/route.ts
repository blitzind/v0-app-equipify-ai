import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_SETUP_MESSAGE,
  isGrowthTerritoryIntelligenceSchemaReady,
} from "@/lib/growth/territory-intelligence/territory-intelligence-schema-health"
import { GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER } from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import {
  createTerritory,
  createTerritoryFromSavedSearch,
  listTerritories,
  loadTerritoryMapSnapshot,
  refreshTerritoryIntelligence,
} from "@/lib/growth/territory-intelligence/territory-repository"
import { normalizeTerritoryFilter } from "@/lib/growth/prospect-search/prospect-search-geo"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthTerritoryIntelligenceSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_SETUP_MESSAGE },
      territories: [],
      snapshot: null,
    })
  }

  const url = new URL(request.url)
  const territoryId = url.searchParams.get("territory_id")
  const refresh = url.searchParams.get("refresh") === "1"

  if (territoryId && z.string().uuid().safeParse(territoryId).success) {
    try {
      const snapshot = refresh
        ? await refreshTerritoryIntelligence(access.admin, territoryId)
        : await loadTerritoryMapSnapshot(access.admin, territoryId)
      return NextResponse.json({
        ok: true,
        qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
        meta: { schemaReady: true },
        snapshot,
      })
    } catch {
      return NextResponse.json({ error: "fetch_failed", message: "Could not load territory map." }, { status: 500 })
    }
  }

  const territories = await listTerritories(access.admin)
  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
    meta: { schemaReady: true },
    territories,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthTerritoryIntelligenceSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: false,
      message: GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_SETUP_MESSAGE,
    })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const savedSearchId = typeof body.saved_search_id === "string" ? body.saved_search_id : null
  if (savedSearchId && z.string().uuid().safeParse(savedSearchId).success) {
    const territory = await createTerritoryFromSavedSearch(access.admin, {
      saved_search_id: savedSearchId,
      name: typeof body.name === "string" ? body.name : null,
      created_by: access.userId,
    })
    if (!territory) {
      return NextResponse.json({ error: "create_failed", message: "Could not create territory from saved search." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER, territory })
  }

  const territoryFilter = normalizeTerritoryFilter(
    body.territory_filter && typeof body.territory_filter === "object"
      ? (body.territory_filter as Parameters<typeof normalizeTerritoryFilter>[0])
      : {},
  )

  const territory = await createTerritory(access.admin, {
    name: typeof body.name === "string" ? body.name : null,
    territory_filter: territoryFilter,
    industry: typeof body.industry === "string" ? body.industry : null,
    icp_label: typeof body.icp_label === "string" ? body.icp_label : null,
    query_text: typeof body.query_text === "string" ? body.query_text : "",
    filters: normalizeProspectSearchFilters(
      body.filters && typeof body.filters === "object"
        ? (body.filters as Parameters<typeof normalizeProspectSearchFilters>[0])
        : { territory_filter: territoryFilter },
    ),
    created_by: access.userId,
  })

  if (!territory) {
    return NextResponse.json({ error: "create_failed", message: "Could not create territory." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER, territory })
}
