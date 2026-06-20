import { NextResponse } from "next/server"
import {
  GROWTH_SENDR_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { computeSendrPageEngagementIntelligence } from "@/lib/growth/sendr/growth-sendr-engagement-intelligence-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"
import { buildSendrLeadIntelligenceView } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import { getGrowthSendrWorkspaceIntelligence } from "@/lib/growth/sendr/growth-sendr-workspace-intelligence-service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const landingPageId = url.searchParams.get("landingPageId")
  const leadId = url.searchParams.get("leadId")

  try {
    if (landingPageId) {
      const page = await computeSendrPageEngagementIntelligence(access.admin, {
        organizationId: access.organizationId,
        landingPageId,
      })
      return NextResponse.json({ ok: true, page, qa_marker: GROWTH_SENDR_INTELLIGENCE_QA_MARKER })
    }

    if (leadId) {
      const lead = await buildSendrLeadIntelligenceView(access.admin, {
        organizationId: access.organizationId,
        leadId,
      })
      if (!lead) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
      }
      return NextResponse.json({ ok: true, lead, qa_marker: GROWTH_SENDR_INTELLIGENCE_QA_MARKER })
    }

    const intelligence = await getGrowthSendrWorkspaceIntelligence(
      access.admin,
      access.organizationId,
    )
    return NextResponse.json({ ok: true, intelligence, qa_marker: GROWTH_SENDR_INTELLIGENCE_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "intelligence_load_failed" },
      { status: 500 },
    )
  }
}
