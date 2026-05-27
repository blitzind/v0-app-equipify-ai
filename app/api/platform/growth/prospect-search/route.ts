import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { executeProspectSearchAction } from "@/lib/growth/prospect-search/prospect-search-actions"
import { listProspectSearchLists } from "@/lib/growth/prospect-search/list-management"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import { listProspectSearchSavedSearches } from "@/lib/growth/prospect-search/saved-searches"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS,
  GROWTH_PROSPECT_SEARCH_SOURCE_TYPES,
  type GrowthProspectSearchCompanyResult,
  type GrowthProspectSearchDiscoveryMode,
  type GrowthProspectSearchFilters,
  type GrowthProspectSearchPersonResult,
  type GrowthProspectSearchResultAction,
  type GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const runtime = "nodejs"

function parseSelectedRefs(raw: unknown): Array<{
  source_type: GrowthProspectSearchSourceType
  id: string
  company_name?: string
}> {
  if (!Array.isArray(raw)) return []
  const refs: Array<{
    source_type: GrowthProspectSearchSourceType
    id: string
    company_name?: string
  }> = []

  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const source_type =
      typeof row.source_type === "string" ? row.source_type.trim() : ""
    const id = typeof row.id === "string" ? row.id.trim() : ""
    if (
      !GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.includes(source_type as GrowthProspectSearchSourceType) ||
      !id
    ) {
      continue
    }
    refs.push({
      source_type: source_type as GrowthProspectSearchSourceType,
      id,
      company_name: typeof row.company_name === "string" ? row.company_name : undefined,
    })
  }

  return refs
}

function parseDiscoveryMode(raw: unknown): GrowthProspectSearchDiscoveryMode {
  return raw === "discover_external" ? "discover_external" : "internal"
}

function parseFiltersParam(raw: string | null): Partial<GrowthProspectSearchFilters> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Partial<GrowthProspectSearchFilters>
  } catch {
    return {}
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? ""
  const filters = parseFiltersParam(url.searchParams.get("filters"))
  const includeMeta = url.searchParams.get("meta") === "1"

  const discovery_mode =
    url.searchParams.get("mode") === "discover_external" ? "discover_external" : "internal"

  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10)
  const page_size = Number.parseInt(url.searchParams.get("page_size") ?? "50", 10)

  const result = await runProspectSearch(access.admin, {
    query,
    filters,
    discovery_mode,
    created_by: access.userId,
    page: Number.isFinite(page) ? page : 1,
    page_size: Number.isFinite(page_size) ? page_size : 50,
  })

  if (!includeMeta) {
    return NextResponse.json({ ok: true, ...result })
  }

  const [saved_searches, lists] = await Promise.all([
    listProspectSearchSavedSearches(access.admin),
    listProspectSearchLists(access.admin),
  ])

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
    result,
    saved_searches,
    lists,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === "string" ? body.action.trim() : ""
  if (!GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS.includes(action as GrowthProspectSearchResultAction)) {
    return NextResponse.json(
      { ok: false, error: "invalid_action", message: "Unknown prospect search action." },
      { status: 400 },
    )
  }

  const actionResult = await executeProspectSearchAction(access.admin, {
    action: action as GrowthProspectSearchResultAction,
    userId: access.userId,
    query: typeof body.query === "string" ? body.query : "",
    filters:
      body.filters && typeof body.filters === "object"
        ? (body.filters as GrowthProspectSearchFilters)
        : {},
    saved_search_name: typeof body.saved_search_name === "string" ? body.saved_search_name : undefined,
    list_name: typeof body.list_name === "string" ? body.list_name : undefined,
    list_id: typeof body.list_id === "string" ? body.list_id : undefined,
    discovery_mode: parseDiscoveryMode(body.discovery_mode),
    selected: parseSelectedRefs(body.selected),
    company:
      body.company && typeof body.company === "object"
        ? (body.company as GrowthProspectSearchCompanyResult)
        : null,
    person:
      body.person && typeof body.person === "object"
        ? (body.person as GrowthProspectSearchPersonResult)
        : null,
    territory_name: typeof body.territory_name === "string" ? body.territory_name : undefined,
    territory_id: typeof body.territory_id === "string" ? body.territory_id : undefined,
    saved_search_id: typeof body.saved_search_id === "string" ? body.saved_search_id : undefined,
  })

  return NextResponse.json({ ok: actionResult.ok, ...actionResult })
}
