import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { normalizeProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-normalizer"
import type {
  NormalizedProspectSearchIntent,
  ProspectSearchIntent,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export const runtime = "nodejs"
export const maxDuration = 60

function isNormalizedIntent(value: unknown): value is NormalizedProspectSearchIntent {
  return Boolean(value && typeof value === "object" && "prospect_search_filters" in (value as object))
}

function isIntent(value: unknown): value is ProspectSearchIntent {
  return Boolean(value && typeof value === "object" && "raw_query" in (value as object))
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const query = typeof body?.query === "string" ? body.query.trim() : ""
  const intentBody = body?.intent
  const normalizedBody = body?.normalized_intent

  let planInput: ProspectSearchIntent | NormalizedProspectSearchIntent | null = null

  if (isNormalizedIntent(normalizedBody)) {
    planInput = normalizedBody
  } else if (isIntent(intentBody)) {
    planInput = intentBody
  } else if (query.length >= 3) {
    planInput = parseProspectSearchIntent(query)
  }

  if (!planInput) {
    return NextResponse.json(
      { ok: false, error: "input_required", message: "Provide query, intent, or normalized_intent." },
      { status: 400 },
    )
  }

  const normalized =
    "prospect_search_filters" in planInput ? planInput : normalizeProspectSearchIntent(planInput)
  const plan = buildProspectSearchPlan(normalized)

  return NextResponse.json({
    ok: true,
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    plan,
    requires_human_review: true,
    search_execution_enabled: false,
  })
}
