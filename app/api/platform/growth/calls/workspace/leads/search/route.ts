import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { searchCallWorkspaceLeads } from "@/lib/growth/native-dialer/call-workspace-lead-search"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export const runtime = "nodejs"

function readSearchQuery(request: Request): string {
  const params = new URL(request.url).searchParams
  return (params.get("q") ?? params.get("query") ?? "").trim()
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) {
    const body = await access.response.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
        error: (body as { error?: string }).error ?? "access_denied",
        message: (body as { message?: string }).message ?? "Access denied.",
        results: [],
        leads: [],
      },
      { status: access.response.status },
    )
  }

  const q = readSearchQuery(request)
  const debug =
    new URL(request.url).searchParams.get("debug") === "1" &&
    process.env.NODE_ENV !== "production"

  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
      results: [],
      leads: [],
      diagnostics: {
        qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
        query: q,
        sourceCounts: {
          growth_leads: 0,
          prospects: 0,
          contacts: 0,
          accounts: 0,
          decision_makers: 0,
          outbound_contacts: 0,
          import_leads: 0,
          relationship_memory: 0,
        },
        matchedEntityTypes: [],
        resultCount: 0,
        autoSelectedLeadId: null,
      },
    })
  }

  try {
    const { results, diagnostics } = await searchCallWorkspaceLeads(access.admin, q, { debug })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
      results,
      leads: results,
      entities: results,
      diagnostics,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed."
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
        error: "search_failed",
        message,
        results: [],
        leads: [],
      },
      { status: 500 },
    )
  }
}
