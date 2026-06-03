import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { confirmCreateOpportunityFromReply } from "@/lib/growth/reply-intelligence/execute-reply-workflow-actions"
import {
  GROWTH_OPPORTUNITY_FORECAST_CATEGORIES,
  GROWTH_OPPORTUNITY_PRIORITIES,
  GROWTH_OPPORTUNITY_STAGE_KEYS,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadId: z.string().uuid(),
  replyId: z.string().uuid().optional(),
  workflowActionId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  amount: z.number().min(0).optional(),
  stageKey: z.enum(GROWTH_OPPORTUNITY_STAGE_KEYS).optional(),
  forecastCategory: z.enum(GROWTH_OPPORTUNITY_FORECAST_CATEGORIES).optional(),
  priority: z.enum(GROWTH_OPPORTUNITY_PRIORITIES).optional(),
  expectedCloseDate: z.string().nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  try {
    const result = await confirmCreateOpportunityFromReply(access.admin, {
      ...parsed.data,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const code = e instanceof Error ? e.message : "create_opportunity_failed"
    const status = code === "opportunity_already_exists" ? 409 : 400
    return NextResponse.json({ error: code }, { status })
  }
}
