import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { assignThreadOwner } from "@/lib/growth/inbox/thread-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"

export const runtime = "nodejs"

const AssignSchema = z.object({
  ownerUserId: z.string().uuid().nullable().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = AssignSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid thread assignment payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const thread = await assignThreadOwner(access.admin, id, {
      owner_user_id: parsed.data.ownerUserId ?? access.userId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, thread })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign thread owner."
    const status = message === "inbox_thread_not_found" ? 404 : 500
    return NextResponse.json({ error: "inbox_thread_assign_failed", message }, { status })
  }
}
