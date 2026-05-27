import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { planMultichannelSequenceTasks } from "@/lib/growth/multichannel/channel-task-planner"
import { isGrowthMultichannelSequencesSchemaReady } from "@/lib/growth/multichannel/schema-health"

export const runtime = "nodejs"

const BodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMultichannelSequencesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid plan payload." }, { status: 400 })
  }

  try {
    const result = await planMultichannelSequenceTasks(access.admin, {
      limit: parsed.data.limit ?? 25,
      actingUserId: access.userId,
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not plan channel tasks."
    return NextResponse.json({ error: "plan_failed", message }, { status: 500 })
  }
}
