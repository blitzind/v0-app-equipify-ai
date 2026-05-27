import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthInboxTeamOwnershipSchemaReady } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"
import { claimInboxThread } from "@/lib/growth/inbox-team-ownership/inbox-thread-ownership-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }
  if (!(await isGrowthInboxTeamOwnershipSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox team ownership migration." }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const thread = await claimInboxThread(access.admin, id, {
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, thread })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not claim thread."
    const status =
      message === "inbox_thread_not_found" ? 404 : message === "thread_already_owned" ? 409 : 500
    return NextResponse.json({ error: "claim_failed", message }, { status })
  }
}
