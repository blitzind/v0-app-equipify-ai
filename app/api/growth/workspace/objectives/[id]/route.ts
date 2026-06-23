import { NextResponse } from "next/server"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import {
  adjustGrowthObjectiveTarget,
  adaptGrowthObjective,
  archiveGrowthObjective,
  emergencyStopGrowthObjective,
  ingestGrowthObjectiveSignal,
  pauseGrowthObjective,
  replanGrowthObjective,
  resumeGrowthObjective,
  startGrowthObjectiveRuntime,
  stopGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-service"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
  type GrowthObjectiveInboundSignal,
} from "@/lib/growth/objectives/growth-objective-types"
import { tickGrowthObjectiveRuntime, retryGrowthObjectiveStage } from "@/lib/growth/objectives/growth-objective-runtime-service"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

function operatorRuntimeInput(access: { userId: string; userEmail: string }) {
  return {
    actorUserId: access.userId,
    actorUserEmail: access.userEmail,
  }
}

export async function GET(request: Request, context: RouteContext) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response
  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError("organization_missing", "Organization not configured.", 503)
  }

  const { id } = await context.params
  const objective = await getGrowthObjective(access.admin, access.organizationId, id)
  if (!objective) {
    return growthWorkspaceSettingsJsonError("objective_not_found", "Objective not found.", 404)
  }

  return NextResponse.json({ ok: true, qa_marker: GROWTH_OBJECTIVE_QA_MARKER, objective })
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response
  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError("organization_missing", "Organization not configured.", 503)
  }

  const { id } = await context.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return growthWorkspaceSettingsJsonError("invalid_json", "Request body must be JSON.", 400)
  }

  const action = typeof body.action === "string" ? body.action : ""

  try {
    switch (action) {
      case "pause":
        return jsonObjective(await pauseGrowthObjective(access.admin, access.organizationId, id))
      case "resume":
        return jsonObjective(
          await resumeGrowthObjective(access.admin, access.organizationId, id, operatorRuntimeInput(access)),
        )
      case "start":
        return jsonObjective(
          await startGrowthObjectiveRuntime(access.admin, access.organizationId, id, operatorRuntimeInput(access)),
        )
      case "stop":
        return jsonObjective(
          await stopGrowthObjectiveRuntime(access.admin, access.organizationId, id, { reason: "Operator stop" }),
        )
      case "tick":
        return jsonObjective(
          await tickGrowthObjectiveRuntime(access.admin, access.organizationId, id, operatorRuntimeInput(access)),
        )
      case "retry_stage":
        return jsonObjective(
          await retryGrowthObjectiveStage(access.admin, access.organizationId, id, operatorRuntimeInput(access)),
        )
      case "ingest_signal": {
        const signal = body.signal as GrowthObjectiveInboundSignal
        if (!signal?.type) {
          return growthWorkspaceSettingsJsonError("invalid_signal", "Signal type required.", 400)
        }
        return jsonObjective(
          await ingestGrowthObjectiveSignal(access.admin, access.organizationId, id, signal, operatorRuntimeInput(access)),
        )
      }
      case "replan":
      case "regenerate_plan": {
        const result = await replanGrowthObjective(access.admin, access.organizationId, id)
        return NextResponse.json({
          ok: true,
          qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
          runtime_qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
          objective: result.objective,
          orchestration: result.orchestration,
        })
      }
      case "rebuild_context": {
        const { rebuildGrowthObjectiveExecutionContext } = await import(
          "@/lib/growth/objectives/growth-objective-materialization-service"
        )
        return jsonObjective(
          await rebuildGrowthObjectiveExecutionContext(access.admin, access.organizationId, id),
        )
      }
      case "archive":
        return jsonObjective(await archiveGrowthObjective(access.admin, access.organizationId, id))
      case "emergency_stop":
        return jsonObjective(await emergencyStopGrowthObjective(access.admin, access.organizationId, id))
      case "increase_target":
      case "reduce_target": {
        const current = await getGrowthObjective(access.admin, access.organizationId, id)
        if (!current) {
          return growthWorkspaceSettingsJsonError("objective_not_found", "Objective not found.", 404)
        }
        const delta = action === "increase_target" ? 5 : -5
        const nextTarget = Math.max(1, current.targetValue + delta)
        return jsonObjective(
          await adjustGrowthObjectiveTarget(access.admin, access.organizationId, id, nextTarget),
        )
      }
      case "adapt": {
        const signals = (body.signals as Record<string, unknown>) ?? {}
        return jsonObjective(
          await adaptGrowthObjective(access.admin, access.organizationId, id, {
            opens: Number(signals.opens ?? 0),
            clicks: Number(signals.clicks ?? 0),
            replies: Number(signals.replies ?? 0),
            videoViews: Number(signals.videoViews ?? 0),
            videoCompletions: Number(signals.videoCompletions ?? 0),
            bookings: Number(signals.bookings ?? 0),
            engagementScore: Number(signals.engagementScore ?? 0),
            intentScore: Number(signals.intentScore ?? 0),
            sequenceReplyRate: Number(signals.sequenceReplyRate ?? 0),
            sequenceOpenRate: Number(signals.sequenceOpenRate ?? 0),
          }),
        )
      }
      default:
        return growthWorkspaceSettingsJsonError("invalid_action", "Unknown objective action.", 400)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Objective action failed."
    return growthWorkspaceSettingsJsonError("objective_action_failed", message, 500)
  }
}

function jsonObjective(objective: Awaited<ReturnType<typeof pauseGrowthObjective>>) {
  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    runtime_qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
    objective,
  })
}
