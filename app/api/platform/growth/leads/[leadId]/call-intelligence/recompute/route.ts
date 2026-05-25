import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateCallIntelligenceScorecard } from "@/lib/growth/call-intelligence/call-intelligence-service"
import { GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/call-intelligence/call-intelligence-types"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    realtimeSessionId?: string | null
    meetingId?: string | null
  }

  const realtimeSessionId =
    body.realtimeSessionId && z.string().uuid().safeParse(body.realtimeSessionId).success
      ? body.realtimeSessionId
      : null
  const meetingId =
    body.meetingId && z.string().uuid().safeParse(body.meetingId).success ? body.meetingId : null

  const result = await generateCallIntelligenceScorecard({
    admin: access.admin,
    leadId,
    realtimeSessionId,
    meetingId,
    trigger: "manual_recompute",
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message, qaMarker: GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER },
      { status: result.code === "not_found" ? 404 : result.code === "insufficient_data" ? 422 : 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
    leadId,
    scorecard: result.scorecard,
  })
}
