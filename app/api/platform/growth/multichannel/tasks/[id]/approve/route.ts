import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { approveChannelTask } from "@/lib/growth/multichannel/channel-task-runner"
import { isGrowthMultichannelSequencesSchemaReady } from "@/lib/growth/multichannel/schema-health"
import { GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE } from "@/lib/growth/multichannel/multichannel-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApprovalConfirmed: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMultichannelSequencesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid approve payload." }, { status: 400 })
  }
  if (parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human approval confirmation required." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const task = await approveChannelTask(access.admin, {
      taskId: id,
      actorUserId: access.userId,
      humanApprovalConfirmed: true,
    })
    return NextResponse.json({
      ok: true,
      task,
      privacy_note: GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE,
      message: "Approval recorded — no autonomous external action performed.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve channel task."
    const status =
      message === "task_not_found"
        ? 404
        : message === "invalid_status" || message === "future_channel_blocked" || message === "human_approval_confirmed_required"
          ? 400
          : 500
    return NextResponse.json({ error: "approve_failed", message }, { status })
  }
}
