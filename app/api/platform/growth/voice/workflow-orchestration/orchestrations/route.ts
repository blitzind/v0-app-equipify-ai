import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createWorkflowOrchestrationRecord,
  fetchWorkflowOrchestrationWorkspace,
} from "@/lib/voice/workflow-orchestration/workflow-orchestration-service"
import type { VoiceWorkflowOrchestrationType } from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_ORCHESTRATION_TYPES } from "@/lib/voice/workflow-orchestration/types"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const workspace = await fetchWorkflowOrchestrationWorkspace(ctx.admin, ctx.organizationId)
    return NextResponse.json({
      ok: true,
      orchestrations: workspace.activeOrchestrations,
      stalled: workspace.stalledOrchestrations,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      orchestrationType?: string
      sourceSessionId?: string | null
      sourceCallId?: string | null
      sourceCampaignId?: string | null
      relationshipMemoryProfileId?: string | null
      relatedCustomerId?: string | null
      relatedProspectId?: string | null
      relatedOpportunityId?: string | null
      orchestrationSummary?: string
      metadata?: Record<string, unknown>
    }

    if (!body.orchestrationType || !VOICE_WORKFLOW_ORCHESTRATION_TYPES.includes(body.orchestrationType as VoiceWorkflowOrchestrationType)) {
      return NextResponse.json({ error: "invalid_type", message: "Invalid orchestration type." }, { status: 400 })
    }

    const orchestration = await createWorkflowOrchestrationRecord(ctx.admin, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      orchestrationType: body.orchestrationType as VoiceWorkflowOrchestrationType,
      sourceSessionId: body.sourceSessionId,
      sourceCallId: body.sourceCallId,
      sourceCampaignId: body.sourceCampaignId,
      relationshipMemoryProfileId: body.relationshipMemoryProfileId,
      relatedCustomerId: body.relatedCustomerId,
      relatedProspectId: body.relatedProspectId,
      relatedOpportunityId: body.relatedOpportunityId,
      orchestrationSummary: body.orchestrationSummary,
      metadata: body.metadata,
    })

    return NextResponse.json({ ok: true, orchestration })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
