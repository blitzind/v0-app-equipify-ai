import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  buildOpportunityIntelligenceViewModel,
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-aggregator"
import { GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"

export const GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER =
  "ge-ava-home-opportunity-intelligence-1a-v1" as const

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Growth AI organization is not configured." },
      { status: 503 },
    )
  }

  const { leadId } = await context.params
  const lead_id = leadId?.trim()
  if (!lead_id) {
    return NextResponse.json({ ok: false, message: "leadId is required." }, { status: 400 })
  }

  const viewModel = await buildOpportunityIntelligenceViewModel({
    admin: access.admin,
    leadId: lead_id,
    organizationId,
  })

  if (!viewModel) {
    return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 })
  }

  const researchSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(access.admin, {
    organizationId,
    leadId: lead_id,
  })

  return NextResponse.json(
    {
      ok: true,
      readOnly: true,
      qa_marker: GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER,
      layer_qa_marker: GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER,
      leadId: lead_id,
      viewModel,
      researchStatus: researchSnapshot
        ? {
            available: true,
            workflowStatus: researchSnapshot.workflowStatus,
            updatedAt: researchSnapshot.updatedAt,
            researchRunId: researchSnapshot.researchRunId,
          }
        : { available: false, workflowStatus: null, updatedAt: null, researchRunId: null },
    },
    {
      headers: {
        "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL,
      },
    },
  )
}
