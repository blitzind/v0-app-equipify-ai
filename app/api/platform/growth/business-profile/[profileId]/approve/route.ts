import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { approveBusinessProfileForOrganization } from "@/lib/growth/business-profile/business-profile-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ profileId: string }> }

export async function POST(request: Request, context: RouteContext) {
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

  const { profileId } = await context.params

  try {
    const profile = await approveBusinessProfileForOrganization(access.admin, {
      organizationId,
      profileId,
      approvedBy: access.userId,
    })

    const response: GrowthBusinessProfileApiResponse = {
      ok: true,
      qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
      schemaReady: true,
      profile,
      activeApproved: profile,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve Business Profile."
    const status = /not found/i.test(message) ? 404 : /Only draft/i.test(message) ? 409 : 500
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER, message } satisfies GrowthBusinessProfileApiResponse,
      { status },
    )
  }
}
