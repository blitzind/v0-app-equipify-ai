import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { buildProspectSearchSuggestions } from "@/lib/growth/prospect-discovery/prospect-search-suggestions"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const query = url.searchParams.get("query")?.trim() ?? ""

  const suggestions = buildProspectSearchSuggestions(
    query.length >= 2 ? { query } : query.length === 0 ? {} : { intent: parseProspectSearchIntent(query) },
  )

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    ...suggestions,
    search_execution_enabled: false,
  })
}
