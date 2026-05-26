import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { searchCallWorkspaceLeads } from "@/lib/growth/native-dialer/call-workspace-lead-search"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
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
    const { results, diagnostics } = await searchCallWorkspaceLeads(access.admin, q)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
      results,
      leads: results,
      diagnostics,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed."
    return NextResponse.json({ error: "search_failed", message }, { status: 500 })
  }
}
