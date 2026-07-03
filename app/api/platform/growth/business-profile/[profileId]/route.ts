import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { updateBusinessProfileDraftForOrganization } from "@/lib/growth/business-profile/business-profile-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ProfileContentSchema: z.ZodType<BusinessProfileDraftContent> = z.object({
  company: z.object({
    companyName: z.string(),
    website: z.string(),
    shortDescription: z.string(),
    productsServices: z.array(z.string()),
    businessModel: z.string(),
    primaryValueProposition: z.string(),
  }),
  idealCustomers: z.object({
    targetIndustries: z.array(z.string()),
    companySizeRanges: z.array(z.string()),
    geography: z.array(z.string()),
    buyerPersonas: z.array(z.string()),
    disqualifiers: z.array(z.string()),
  }),
  problemsAndTriggers: z.object({
    painPoints: z.array(z.string()),
    buyingTriggers: z.array(z.string()),
    competitorsAlternatives: z.array(z.string()),
    keywords: z.array(z.string()),
    negativeKeywords: z.array(z.string()),
  }),
  salesAndMarketing: z.object({
    averageDealSize: z.string().nullable(),
    salesCycleEstimate: z.string().nullable(),
    messagingAngles: z.array(z.string()),
    qualificationCriteria: z.array(z.string()),
  }),
  confidence: z.object({
    score: z.number(),
    assumptions: z.array(z.string()),
    missingInformation: z.array(z.string()),
  }),
  draftSource: z.enum(["deterministic", "ai_assisted", "ai_fallback"]).optional(),
  websiteContextSummary: z.string().nullable().optional(),
})

const BodySchema = z.object({
  companyName: z.string().trim().min(1).max(256).optional(),
  website: z.string().trim().min(3).max(2048).optional(),
  profile: ProfileContentSchema.optional(),
})

type RouteContext = { params: Promise<{ profileId: string }> }

export async function PUT(request: Request, context: RouteContext) {
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
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
        message: "Invalid Business Profile update payload.",
      } satisfies GrowthBusinessProfileApiResponse,
      { status: 400 },
    )
  }

  if (!parsed.data.companyName && !parsed.data.website && !parsed.data.profile) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
        message: "Provide at least one field to update.",
      } satisfies GrowthBusinessProfileApiResponse,
      { status: 400 },
    )
  }

  try {
    const profile = await updateBusinessProfileDraftForOrganization(access.admin, {
      organizationId,
      profileId,
      companyName: parsed.data.companyName,
      website: parsed.data.website,
      profile: parsed.data.profile,
    })

    const response: GrowthBusinessProfileApiResponse = {
      ok: true,
      qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
      schemaReady: true,
      profile,
      latestDraft: profile,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Business Profile."
    const status = /not found/i.test(message) ? 404 : /Only draft/i.test(message) ? 409 : 500
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER, message } satisfies GrowthBusinessProfileApiResponse,
      { status },
    )
  }
}
