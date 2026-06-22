import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { validateMailboxConnection } from "@/lib/growth/mailboxes/mailbox-repository"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const mailbox = await validateMailboxConnection(access.admin, id, {
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, mailbox })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed."
    const status = message === "mailbox_not_found" ? 404 : 500
    return NextResponse.json({ error: "mailbox_validate_failed", message }, { status })
  }
}
