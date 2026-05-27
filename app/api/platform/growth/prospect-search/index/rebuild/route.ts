import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_PROSPECT_SEARCH_INDEX_BUILDER_QA_MARKER,
  rebuildProspectSearchMaterializedIndex,
  type ProspectSearchIndexRebuildMode,
} from "@/lib/growth/prospect-search/prospect-search-index-builder"
import { GROWTH_PROSPECT_SEARCH_SOURCE_TYPES } from "@/lib/growth/prospect-search/prospect-search-types"

export const runtime = "nodejs"

function parseRebuildMode(raw: unknown): ProspectSearchIndexRebuildMode | null {
  if (raw === "full" || raw === "source_type" || raw === "source_id") return raw
  return null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const mode = parseRebuildMode(body.mode)
  if (!mode) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid rebuild mode. Use full, source_type, or source_id.",
      },
      { status: 400 },
    )
  }

  const source_type =
    typeof body.source_type === "string" &&
    GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.includes(
      body.source_type as (typeof GROWTH_PROSPECT_SEARCH_SOURCE_TYPES)[number],
    )
      ? (body.source_type as (typeof GROWTH_PROSPECT_SEARCH_SOURCE_TYPES)[number])
      : undefined

  const source_id = typeof body.source_id === "string" ? body.source_id.trim() : undefined

  const result = await rebuildProspectSearchMaterializedIndex(access.admin, {
    mode,
    source_type,
    source_id,
  })

  return NextResponse.json({
    ok: result.ok,
    qa_marker: GROWTH_PROSPECT_SEARCH_INDEX_BUILDER_QA_MARKER,
    mode: result.mode,
    rows_indexed: result.rows_indexed,
    rows_updated: result.rows_updated,
    rows_skipped: result.rows_skipped,
    rows_failed: result.rows_failed,
    duration_ms: result.duration_ms,
    message: result.message,
  })
}
