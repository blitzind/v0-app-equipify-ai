import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  completeGrowthCadenceTask,
  skipGrowthCadenceTask,
} from "@/lib/growth/cadence/mutate-cadence-task"
import { GROWTH_CADENCE_TASK_OUTCOMES } from "@/lib/growth/cadence/cadence-types"
import { GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE, isGrowthCadenceSchemaReady } from "@/lib/growth/cadence/cadence-schema-health"

export const runtime = "nodejs"

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete"),
    outcome: z.enum(GROWTH_CADENCE_TASK_OUTCOMES),
  }),
  z.object({
    action: z.literal("skip"),
    reason: z.string().min(1).max(500),
  }),
])

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCadenceSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_incomplete", message: GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const { taskId } = await context.params
  if (!z.string().uuid().safeParse(taskId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid task id." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid cadence task update." }, { status: 400 })
  }

  try {
    const task =
      parsed.data.action === "complete"
        ? await completeGrowthCadenceTask(access.admin, {
            taskId,
            outcome: parsed.data.outcome,
            actingUserId: access.userId,
            actingUserEmail: access.userEmail,
          })
        : await skipGrowthCadenceTask(access.admin, {
            taskId,
            reason: parsed.data.reason,
            actingUserId: access.userId,
            actingUserEmail: access.userEmail,
          })
    return NextResponse.json({ ok: true, task })
  } catch (e) {
    const message = e instanceof Error && e.message === "not_found" ? "Task not found." : "Could not update cadence task."
    const status = e instanceof Error && e.message === "not_found" ? 404 : 400
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
