import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchWorkflowOrchestrationWorkspace } from "@/lib/voice/workflow-orchestration/workflow-orchestration-service"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const workspace = await fetchWorkflowOrchestrationWorkspace(ctx.admin, ctx.organizationId)
    return NextResponse.json({ ok: true, workspace })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
