import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { skipChannelTask } from "@/lib/growth/multichannel/channel-task-runner"
import { isGrowthMultichannelSequencesSchemaReady } from "@/lib/growth/multichannel/schema-health"

export const runtime = "nodejs"

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid skip payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const task = await skipChannelTask(access.admin, {
      taskId: id,
      actorUserId: access.userId,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ ok: true, task })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not skip channel task."
    const status = message === "task_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "skip_failed", message }, { status })
  }
}
