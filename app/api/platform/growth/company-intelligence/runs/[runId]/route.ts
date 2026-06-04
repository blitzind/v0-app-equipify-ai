import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadCompanyIntelligenceRunDetail } from "@/lib/growth/company-intelligence/company-intelligence-repository"
import { isGrowthCompanyIntelligenceSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import {
  GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  if (!runId) {
    return NextResponse.json({ ok: false, error: "missing_run_id" }, { status: 400 })
  }

  if (!(await isGrowthCompanyIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
      },
      { status: 503 },
    )
  }

  const detail = await loadCompanyIntelligenceRunDetail(access.admin, runId)
  if (!detail) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
    detail,
  })
}
