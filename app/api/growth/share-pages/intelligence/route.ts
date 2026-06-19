import { NextResponse } from "next/server"
import { growthSharePageIntelligenceQuerySchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { loadGrowthSharePageIntelligenceResponse } from "@/lib/growth/share-pages/growth-share-page-intelligence-service"
import {
  GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  growthSharePageIntelligenceSafetyPayload,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"
import {
  growthSharePageWorkspaceSafetyJson,
  mapGrowthSharePageWorkspaceApiError,
} from "@/lib/growth/share-pages/share-page-workspace-api-utils"
import { requireSharePagePlatformAccess } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSharePageIntelligenceQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }
  if (!parsed.data.share_page_id && !parsed.data.lead_id) {
    return NextResponse.json({ ok: false, error: "share_page_id_or_lead_id_required" }, { status: 400 })
  }

  try {
    const intelligence = await loadGrowthSharePageIntelligenceResponse(access.admin, {
      organizationId: access.organizationId,
      sharePageId: parsed.data.share_page_id ?? null,
      leadId: parsed.data.lead_id ?? null,
      sessionId: parsed.data.session_id ?? null,
    })

    return NextResponse.json(
      growthSharePageWorkspaceSafetyJson({
        ok: true,
        intelligence,
        qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
        ...growthSharePageIntelligenceSafetyPayload(),
      }),
    )
  } catch (error) {
    return mapGrowthSharePageWorkspaceApiError(error)
  }
}
