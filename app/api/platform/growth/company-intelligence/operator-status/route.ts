import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import { isGrowthCompanyIntelligenceSchemaReady } from "@/lib/growth/company-intelligence/company-intelligence-schema-health"
import {
  GROWTH_COMPANY_INTELLIGENCE_MIGRATION,
  GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/company-intelligence/company-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export const runtime = "nodejs"

const QuerySchema = z.object({
  company_id: z.string().uuid(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ company_id: url.searchParams.get("company_id") })
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", message: "company_id query param is required." },
      { status: 400 },
    )
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

  const status = await loadCompanyIntelligenceOperatorStatus(access.admin, {
    company_id: parsed.data.company_id,
  })
  if (!status) {
    return NextResponse.json({ ok: false, error: "company_not_found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_COMPANY_INTELLIGENCE_QA_MARKER,
    runtime_qa_marker: GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
    status,
  })
}
