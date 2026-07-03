import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER,
  GROWTH_HOME_AVA_EXECUTE_ACTIONS,
  type GrowthHomeAvaExecuteApiResponse,
} from "@/lib/growth/ava-home/growth-home-ava-execute-api-contract"
import { executeGrowthHomeAvaSafeAction } from "@/lib/growth/ava-home/growth-home-ava-execute-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z.enum(GROWTH_HOME_AVA_EXECUTE_ACTIONS),
  reason: z.string().trim().max(500).optional().nullable(),
})

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Growth AI organization is not configured." },
      { status: 503 },
    )
  }

  const { leadId } = await context.params
  const lead_id = leadId?.trim()
  if (!lead_id) {
    return NextResponse.json({ ok: false, message: "leadId is required." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid action. Allowed: run_unified_intake, start_research, refresh_intelligence." },
      { status: 400 },
    )
  }

  try {
    const result = await executeGrowthHomeAvaSafeAction({
      admin: access.admin,
      organizationId,
      leadId: lead_id,
      action: parsed.data.action,
      reason: parsed.data.reason ?? null,
      actor: { userId: access.userId, email: access.userEmail },
    })

    const response: GrowthHomeAvaExecuteApiResponse = {
      ok: true,
      qa_marker: GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER,
      leadId: lead_id,
      action: parsed.data.action,
      status: result.status,
      readOnly: parsed.data.action === "refresh_intelligence",
      skipReason: result.skipReason ?? null,
      auditEventId: result.auditEventId ?? null,
      workflow: result.workflow ?? null,
      research: result.research ?? null,
      viewModel: result.viewModel,
      researchStatus: result.researchStatus,
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const auditEventId =
      error && typeof error === "object" && "auditEventId" in error
        ? (error.auditEventId as string | null | undefined) ?? null
        : null
    const status =
      message === "lead_not_found"
        ? 404
        : 500

    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER,
        leadId: lead_id,
        action: parsed.data.action,
        status: "failed",
        message: message.slice(0, 240),
        auditEventId,
      } satisfies GrowthHomeAvaExecuteApiResponse,
      { status },
    )
  }
}
