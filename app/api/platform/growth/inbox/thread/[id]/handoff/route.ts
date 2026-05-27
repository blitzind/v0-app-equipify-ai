import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthInboxTeamOwnershipSchemaReady } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"
import { handoffInboxThread } from "@/lib/growth/inbox-team-ownership/inbox-thread-ownership-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"

export const runtime = "nodejs"

const BodySchema = z.object({
  toUserId: z.string().uuid(),
  handoffNote: z.string().trim().max(2000).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }
  if (!(await isGrowthInboxTeamOwnershipSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox team ownership migration." }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid handoff payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const thread = await handoffInboxThread(access.admin, id, {
      toUserId: parsed.data.toUserId,
      handoffNote: parsed.data.handoffNote,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, thread })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not hand off thread."
    const status =
      message === "inbox_thread_not_found" ? 404 : message === "handoff_target_required" ? 400 : 500
    return NextResponse.json({ error: "handoff_failed", message }, { status })
  }
}
