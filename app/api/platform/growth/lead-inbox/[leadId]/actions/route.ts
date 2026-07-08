import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_REVENUE_QUEUE_ACTIONS,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type RevenueQueueAction,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  executeRevenueQueueAction,
  GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER,
} from "@/lib/growth/revenue-queue/revenue-queue-action-bridge"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

function parseAction(body: Record<string, unknown>): RevenueQueueAction | null {
  const action = typeof body.action === "string" ? body.action.trim() : ""
  return GROWTH_REVENUE_QUEUE_ACTIONS.includes(action as RevenueQueueAction)
    ? (action as RevenueQueueAction)
    : null
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = parseAction(body)

  if (!action) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Invalid or missing action." },
      { status: 400 },
    )
  }

  const ownerId =
    typeof body.ownerId === "string" && body.ownerId.trim()
      ? body.ownerId.trim()
      : access.userId

  const reason = typeof body.reason === "string" ? body.reason : undefined

  try {
    const result = await executeRevenueQueueAction(access.admin, {
      leadId,
      action,
      ownerId,
      actorUserId: access.userId,
      reason,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      )
    }

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
      action_bridge_marker: GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER,
      action,
      queue_resolution: result.target,
      workspace: result.workspace,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "action_failed", message }, { status: 500 })
  }
}
