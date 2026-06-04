import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadCompanyIntelligenceLeadRollup } from "@/lib/growth/company-intelligence/company-intelligence-lead-rollup"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import { GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const lead_id = leadId?.trim()
  if (!lead_id) {
    return NextResponse.json({ ok: false, message: "leadId is required." }, { status: 400 })
  }

  const rollup = await loadCompanyIntelligenceLeadRollup(access.admin, lead_id)
  const company_status = rollup.company_id
    ? await loadCompanyIntelligenceOperatorStatus(access.admin, { company_id: rollup.company_id })
    : null

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
    lead_id,
    rollup,
    company_status,
  })
}
