import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isRevenueExecutionPlanEnabled } from "@/lib/growth/contact-verification/revenue-execution-plan-feature"
import {
  buildRevenueExecutionPlanView,
  mapProspectSearchIntelligenceToExecutionPlanInput,
} from "@/lib/growth/contact-verification/revenue-execution-plan-view"
import type { RevenueExecutionPlanApiResponse } from "@/lib/growth/contact-verification/revenue-execution-plan-view"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const runtime = "nodejs"

const ContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  confidence: z.number().optional(),
})

const BodySchema = z.object({
  companyId: z.string().min(1),
  company_name: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  company_match_confidence: z.number().optional(),
  is_suppressed: z.boolean().optional(),
  suppression_reason: z.string().optional(),
  nextBestAction: z.unknown().optional(),
  qualification: z.unknown().optional(),
  sequenceRecommendation: z.unknown().optional(),
  contacts: z.array(ContactSchema).optional(),
  intelligence: z.unknown().optional(),
})

function domainFromWebsite(website: string | null | undefined): string | undefined {
  if (!website?.trim()) return undefined
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    const stripped = website.replace(/^https?:\/\//, "").split("/")[0]?.trim()
    return stripped || undefined
  }
}

function executionPlanInputFromBody(input: z.infer<typeof BodySchema>) {
  if (input.nextBestAction || input.qualification || input.sequenceRecommendation) {
    return {
      engineInput: {
        companyId: input.companyId,
        nextBestAction: input.nextBestAction as NextBestAction | undefined,
        qualification: input.qualification as ProspectQualification | undefined,
        sequenceRecommendation: input.sequenceRecommendation as SequenceRecommendation | undefined,
      },
    }
  }

  if (input.contacts?.length) {
    return {
      engineInput: {
        companyId: input.companyId,
        qualificationInput: {
          companyId: input.companyId,
          acquisitionInput: {
            companyId: input.companyId,
            companyName: input.company_name,
            domain: domainFromWebsite(input.website),
            industry: input.industry,
            contacts: input.contacts.map((contact) => {
              const parts = contact.name.trim().split(/\s+/).filter(Boolean)
              return {
                personId: contact.id,
                firstName: parts[0],
                lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
                fullName: contact.name,
                email: contact.email,
                jobTitle: contact.title,
                phone: contact.phone,
                linkedinUrl: contact.linkedin_url,
                confidence: contact.confidence,
              }
            }),
          },
          prospectIntelligence: {
            companyName: input.company_name,
            domain: domainFromWebsite(input.website),
            industry: input.industry,
            companyMatchConfidence: input.company_match_confidence ?? null,
            isSuppressed: input.is_suppressed,
            suppressionReason: input.suppression_reason ?? null,
            contactCount: input.contacts.length,
          },
        },
      },
    }
  }

  if (!input.intelligence || typeof input.intelligence !== "object") return null

  const intelligence = input.intelligence as GrowthProspectSearchContactIntelligence
  const mapped = mapProspectSearchIntelligenceToExecutionPlanInput({
    companyId: input.companyId,
    companyName: input.company_name,
    website: input.website,
    industry: input.industry,
    companyMatchConfidence: input.company_match_confidence ?? null,
    isSuppressed: input.is_suppressed,
    suppressionReason: input.suppression_reason ?? null,
    intelligence,
  })
  if (!mapped) return null

  return { engineInput: mapped }
}

export async function POST(
  request: Request,
): Promise<NextResponse<RevenueExecutionPlanApiResponse>> {
  if (!isRevenueExecutionPlanEnabled()) {
    return NextResponse.json({ ok: false, enabled: false, message: "revenue_execution_plan_disabled" })
  }

  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response as NextResponse<RevenueExecutionPlanApiResponse>

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "invalid_request" },
      { status: 400 },
    )
  }

  const prepared = executionPlanInputFromBody(parsed.data)
  if (!prepared?.engineInput) {
    return NextResponse.json(
      { ok: false, enabled: true, message: "insufficient_reasoning_context" },
      { status: 400 },
    )
  }

  try {
    const view = await buildRevenueExecutionPlanView(prepared.engineInput, { skipDns: true })

    if (!view) {
      return NextResponse.json({ ok: false, enabled: true, message: "revenue_execution_plan_unavailable" })
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      view,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        enabled: true,
        message: error instanceof Error ? error.message : "revenue_execution_plan_build_failed",
      },
      { status: 500 },
    )
  }
}
