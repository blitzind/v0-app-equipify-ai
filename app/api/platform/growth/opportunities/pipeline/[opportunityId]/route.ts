import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOpportunityDetail } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  updateGrowthOpportunityAmount,
  updateGrowthOpportunityForecastCategory,
  updateGrowthOpportunityOwner,
  updateGrowthOpportunityStage,
} from "@/lib/growth/opportunity-pipeline/mutate-opportunity"
import {
  GROWTH_OPPORTUNITY_FORECAST_CATEGORIES,
  GROWTH_OPPORTUNITY_STAGE_KEYS,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const runtime = "nodejs"

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("stage"),
    stageKey: z.enum(GROWTH_OPPORTUNITY_STAGE_KEYS),
    lossReason: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("owner"),
    ownerUserId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal("amount"),
    amount: z.number().min(0),
  }),
  z.object({
    action: z.literal("forecast"),
    forecastCategory: z.enum(GROWTH_OPPORTUNITY_FORECAST_CATEGORIES),
    expectedCloseDate: z.string().nullable().optional(),
  }),
])

export async function GET(
  _request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { opportunityId } = await context.params
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid opportunity id." }, { status: 400 })
  }

  try {
    const opportunity = await fetchGrowthOpportunityDetail(access.admin, opportunityId)
    if (!opportunity) {
      return NextResponse.json({ error: "not_found", message: "Opportunity not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, opportunity })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load opportunity."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { opportunityId } = await context.params
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid opportunity id." }, { status: 400 })
  }

  try {
    const body = patchSchema.parse(await request.json())
    const actor = { userId: access.userId, email: access.userEmail }

    const result =
      body.action === "stage"
        ? await updateGrowthOpportunityStage(access.admin, {
            opportunityId,
            patch: { stageKey: body.stageKey, lossReason: body.lossReason },
            actor,
          })
        : body.action === "owner"
          ? await updateGrowthOpportunityOwner(access.admin, {
              opportunityId,
              ownerUserId: body.ownerUserId,
              actor,
            })
          : body.action === "amount"
            ? await updateGrowthOpportunityAmount(access.admin, {
                opportunityId,
                amount: body.amount,
                actor,
              })
            : await updateGrowthOpportunityForecastCategory(access.admin, {
                opportunityId,
                forecastCategory: body.forecastCategory,
                expectedCloseDate: body.expectedCloseDate,
                actor,
              })

    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, opportunity: result.opportunity })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", message: "Invalid request body." }, { status: 400 })
    }
    const message = e instanceof Error ? e.message : "Could not update opportunity."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
