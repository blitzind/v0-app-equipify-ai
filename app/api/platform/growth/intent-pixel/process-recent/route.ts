import { NextResponse } from "next/server"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_INTENT_PIXEL_LIVE_QA_MARKER } from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import { processRecentIntentToLeadInbox } from "@/lib/growth/intent-pixel/process-recent-intent-handoff"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const site_key =
    typeof body.site_key === "string" && body.site_key.trim()
      ? body.site_key.trim()
      : "equipify-sandbox"
  const limit =
    typeof body.limit === "number" && body.limit > 0 && body.limit <= 50
      ? Math.round(body.limit)
      : 25

  const result = await processRecentIntentToLeadInbox(access.admin, site_key, { limit })

  logGrowthEngine("intent_pixel_process_recent", {
    site_key,
    ingested_count: result.ingested_count,
    duplicate_count: result.duplicate_count,
    eligible_count: result.eligible_count,
    userId: access.userId,
  })

  return NextResponse.json({
    ok: result.errors.length === 0 || result.ingested_count > 0,
    qa_marker: GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
    result,
  })
}
