import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { createBusinessProfileDraftForOrganization } from "@/lib/growth/business-profile/business-profile-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  companyName: z.string().trim().min(1).max(256),
  website: z.string().trim().min(3).max(2048),
  whatTheySell: z.string().trim().max(2000).optional().nullable(),
  whoTheySellTo: z.string().trim().max(2000).optional().nullable(),
  geography: z.string().trim().max(500).optional().nullable(),
  averageDealSize: z.string().trim().max(200).optional().nullable(),
})

export async function POST(request: Request) {
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

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
        message: "Company name and website are required.",
      } satisfies GrowthBusinessProfileApiResponse,
      { status: 400 },
    )
  }

  try {
    const profile = await createBusinessProfileDraftForOrganization(access.admin, {
      organizationId,
      createdBy: access.userId,
      companyInput: parsed.data,
    })

    const response: GrowthBusinessProfileApiResponse = {
      ok: true,
      qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
      schemaReady: true,
      profile,
      latestDraft: profile,
    }

    return NextResponse.json(response, {
      status: 201,
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not draft Business Profile."
    const status = /not ready/i.test(message) ? 503 : 500
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER, message } satisfies GrowthBusinessProfileApiResponse,
      { status },
    )
  }
}
