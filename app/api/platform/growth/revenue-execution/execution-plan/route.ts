import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSalesExecutionPlanForLead, saveSalesExecutionPlan } from "@/lib/growth/revenue-execution/opportunity-review-service"
import type { GrowthSalesExecutionPlan } from "@/lib/growth/revenue-execution/revenue-execution-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")
  if (!leadId) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 })

  try {
    const plan = await fetchSalesExecutionPlanForLead(access.admin, leadId)
    return NextResponse.json({ ok: true, plan })
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}

const BodySchema = z.object({
  plan: z.custom<GrowthSalesExecutionPlan>(),
  humanApprovalConfirmed: z.literal(true),
})

export async function PUT(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")
  if (!leadId) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 })

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const saved = await saveSalesExecutionPlan(access.admin, leadId, parsed.data.plan)
    return NextResponse.json({ ok: true, plan: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed."
    return NextResponse.json({ error: "save_failed", message }, { status: 500 })
  }
}
