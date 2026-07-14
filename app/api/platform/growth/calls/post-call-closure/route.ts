import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  executeCallWorkspacePostCallClosure,
  previewCallWorkspacePostCallClosure,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure"
import { GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"
import { resolveCallWorkspaceAiosLiveReasoning } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-service"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { NATIVE_CALL_WRAPUP_OUTCOMES } from "@/lib/growth/native-dialer/native-dialer-types"

export const runtime = "nodejs"

const querySchema = z.object({
  sessionId: z.string().uuid(),
  leadId: z.string().uuid(),
  realtimeSessionId: z.string().uuid().optional().nullable(),
  companyName: z.string().optional().nullable(),
  finalize: z.enum(["true", "false"]).optional(),
})

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  leadId: z.string().uuid(),
  realtimeSessionId: z.string().uuid().optional().nullable(),
  companyName: z.string().optional().nullable(),
  outcome: z.enum(NATIVE_CALL_WRAPUP_OUTCOMES).optional(),
  notes: z.string().optional().nullable(),
  objectionCategory: z.string().optional().nullable(),
  buyingSignals: z.array(z.string()).optional(),
  competitorMentioned: z.boolean().optional(),
  timelineDetected: z.boolean().optional(),
  budgetDetected: z.boolean().optional(),
  championIdentified: z.boolean().optional(),
  decisionMakerPresent: z.boolean().optional(),
  meetingBooked: z.boolean().optional(),
  followUpNeeded: z.boolean().optional(),
  connected: z.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    leadId: url.searchParams.get("leadId"),
    realtimeSessionId: url.searchParams.get("realtimeSessionId"),
    companyName: url.searchParams.get("companyName"),
    finalize: url.searchParams.get("finalize") ?? "false",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const orgId = await getGrowthEngineAiOrgId(access.admin)
  const generatedAt = new Date().toISOString()
  const realtimeSession = parsed.data.realtimeSessionId
    ? await fetchGrowthRealtimeCallSession(access.admin, parsed.data.realtimeSessionId).catch(() => null)
    : null

  const liveReasoning = await resolveCallWorkspaceAiosLiveReasoning(access.admin, {
    organizationId: orgId,
    leadId: parsed.data.leadId,
    liveSnapshot: realtimeSession?.liveSnapshot ?? null,
    voiceTranscript: null,
    generatedAt,
    realtimeSessionId: parsed.data.realtimeSessionId,
  }).catch(() => null)

  const closure =
    parsed.data.finalize === "true"
      ? (
          await executeCallWorkspacePostCallClosure(access.admin, {
            organizationId: orgId,
            leadId: parsed.data.leadId,
            companyName: parsed.data.companyName ?? null,
            sessionId: parsed.data.sessionId,
            realtimeSessionId: parsed.data.realtimeSessionId,
            generatedAt,
            liveReasoning,
            scorecard: null,
          })
        ).closure
      : await previewCallWorkspacePostCallClosure(access.admin, {
          organizationId: orgId,
          leadId: parsed.data.leadId,
          companyName: parsed.data.companyName ?? null,
          sessionId: parsed.data.sessionId,
          realtimeSessionId: parsed.data.realtimeSessionId,
          generatedAt,
          liveReasoning,
          scorecard: null,
        })

  return NextResponse.json({ ok: true, qaMarker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER, closure })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const orgId = await getGrowthEngineAiOrgId(access.admin)
  const generatedAt = new Date().toISOString()
  const realtimeSession = parsed.data.realtimeSessionId
    ? await fetchGrowthRealtimeCallSession(access.admin, parsed.data.realtimeSessionId).catch(() => null)
    : null

  const liveReasoning = await resolveCallWorkspaceAiosLiveReasoning(access.admin, {
    organizationId: orgId,
    leadId: parsed.data.leadId,
    liveSnapshot: realtimeSession?.liveSnapshot ?? null,
    voiceTranscript: null,
    generatedAt,
    realtimeSessionId: parsed.data.realtimeSessionId,
  }).catch(() => null)

  const result = await executeCallWorkspacePostCallClosure(access.admin, {
    organizationId: orgId,
    leadId: parsed.data.leadId,
    companyName: parsed.data.companyName ?? null,
    sessionId: parsed.data.sessionId,
    realtimeSessionId: parsed.data.realtimeSessionId,
    generatedAt,
    liveReasoning,
    scorecard: null,
    operatorWrapup: parsed.data,
    operatorDisposition: parsed.data.outcome ?? null,
    operatorNotes: parsed.data.notes ?? null,
  })

  return NextResponse.json({
    ok: true,
    qaMarker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
    closure: result.closure,
    sideEffects: result.sideEffects,
  })
}
