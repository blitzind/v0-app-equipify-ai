import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import { isGrowthBuyingCommitteeIntelligenceSchemaReady } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-schema-health"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const company_id = new URL(request.url).searchParams.get("company_id")?.trim() ?? ""
  if (!company_id) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", message: "company_id is required." },
      { status: 400 },
    )
  }

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

  const status = await loadBuyingCommitteeIntelligenceOperatorStatus(access.admin, { company_id })
  if (!status) {
    return NextResponse.json({ ok: false, error: "company_not_found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    status,
  })
}
