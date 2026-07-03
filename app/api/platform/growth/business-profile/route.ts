import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      } satisfies GrowthBusinessProfileApiResponse,
      { status: 503 },
    )
  }

  try {
    const state = await fetchBusinessProfileWorkspaceState(access.admin, organizationId)
    const response: GrowthBusinessProfileApiResponse = {
      ok: true,
      qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
      schemaReady: state.schemaReady,
      activeApproved: state.activeApproved,
      latestDraft: state.latestDraft,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Business Profile."
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER, message } satisfies GrowthBusinessProfileApiResponse,
      { status: 500 },
    )
  }
}
