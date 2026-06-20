import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { executeProspectSearchAction } from "@/lib/growth/prospect-search/prospect-search-actions"
import { listProspectSearchLists } from "@/lib/growth/prospect-search/list-management"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import { listProspectSearchSavedSearchesWithWorkflow, refreshAllProspectSearchSavedSearchCounts } from "@/lib/growth/prospect-search/saved-searches"
import {
  GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
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
import { withProspectSearchGuardrails } from "@/lib/growth/runtime-guardrails/growth-search-rate-limiter"
import { truncateSearchResults } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

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
  const sort_by = url.searchParams.get("sort_by") === "signal_momentum" ? "signal_momentum" : "rank"
  const result_mode_param = url.searchParams.get("result_mode")
  const result_mode =
    result_mode_param === "companies" ||
    result_mode_param === "territory" ||
    result_mode_param === "queue"
      ? result_mode_param
      : "people"

  try {
    const organizationId = getGrowthEngineAiOrgId()
    if (!organizationId) {
      return NextResponse.json({ error: "growth_engine_org_not_configured" }, { status: 503 })
    }

    const guarded = await withProspectSearchGuardrails(access.admin, {
      organizationId,
      userId: access.userId,
      operation: "search",
      query,
      execute: async () => {
        const result = await runProspectSearch(access.admin, {
          query,
          filters,
          discovery_mode,
          sort_by,
          created_by: access.userId,
          page: Number.isFinite(page) ? page : 1,
          page_size: Number.isFinite(page_size) ? page_size : 50,
          result_mode,
        })

        const people = truncateSearchResults(result.people ?? [])
        const companies = truncateSearchResults(result.companies ?? [])

        return {
          result: {
            ...result,
            people: people.rows,
            companies: companies.rows,
            guardrails: {
              people_truncated: people.truncated,
              companies_truncated: companies.truncated,
            },
          },
          rowsReturned: (result.people?.length ?? 0) + (result.companies?.length ?? 0),
          rowsHydrated: result.discovery_hydration?.hydrated_count ?? 0,
        }
      },
    })

    if (!guarded.ok) {
      return NextResponse.json({ error: guarded.error }, { status: guarded.status })
    }

    const result = guarded.result

    if (!includeMeta) {
      return NextResponse.json({
        ok: true,
        qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
        discovery_runtime_hardening_qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
        safe_provider_parsing_qa_marker: GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER,
        result,
      })
    }

    const refreshSavedCounts = url.searchParams.get("refresh_saved_counts") === "1"

    const [savedResult, listsResult] = await Promise.allSettled([
      refreshSavedCounts
        ? refreshAllProspectSearchSavedSearchCounts(access.admin)
        : listProspectSearchSavedSearchesWithWorkflow(access.admin),
      listProspectSearchLists(access.admin),
    ])

    const saved_searches =
      savedResult.status === "fulfilled" ? savedResult.value : []
    const lists = listsResult.status === "fulfilled" ? listsResult.value : []

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
      discovery_runtime_hardening_qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
      safe_provider_parsing_qa_marker: GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER,
      result,
      saved_searches,
      lists,
      meta_partial:
        savedResult.status === "rejected" || listsResult.status === "rejected"
          ? "Saved search or list metadata partially unavailable."
          : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prospect search failed."
    return NextResponse.json(
      {
        ok: false,
        error: "prospect_search_failed",
        message,
        qa_marker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
        discovery_runtime_hardening_qa_marker: GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER,
        safe_provider_parsing_qa_marker: GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER,
      },
      { status: 500 },
    )
  }
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
    people: Array.isArray(body.people)
      ? (body.people as import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchPeopleActionRow[])
      : undefined,
    territory_name: typeof body.territory_name === "string" ? body.territory_name : undefined,
    territory_id: typeof body.territory_id === "string" ? body.territory_id : undefined,
    saved_search_id: typeof body.saved_search_id === "string" ? body.saved_search_id : undefined,
    page: typeof body.page === "number" ? body.page : Number(body.page) || undefined,
    page_size: typeof body.page_size === "number" ? body.page_size : Number(body.page_size) || undefined,
    save_pagination: body.save_pagination === true,
    result_count: typeof body.result_count === "number" ? body.result_count : Number(body.result_count) || undefined,
    owner_label: typeof body.owner_label === "string" ? body.owner_label : undefined,
  })

  return NextResponse.json({ ok: actionResult.ok, ...actionResult })
}
