import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadBuyingCommitteeIntelligenceRunDetail } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-repository"
import { isGrowthBuyingCommitteeIntelligenceSchemaReady } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-schema-health"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  if (!(await isGrowthBuyingCommitteeIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
      },
      { status: 503 },
    )
  }

  const detail = await loadBuyingCommitteeIntelligenceRunDetail(access.admin, runId)
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    detail,
  })
}
