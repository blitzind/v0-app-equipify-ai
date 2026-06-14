import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { normalizeProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-normalizer"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const query = typeof body?.query === "string" ? body.query.trim() : ""
  if (!query || query.length < 3) {
    return NextResponse.json(
      { ok: false, error: "query_required", message: "Provide a natural language query (min 3 characters)." },
      { status: 400 },
    )
  }

  const intent = parseProspectSearchIntent(query)
  const normalized_intent = normalizeProspectSearchIntent(intent)

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    intent,
    normalized_intent,
    requires_human_review: true,
    search_execution_enabled: false,
  })
}
