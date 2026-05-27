import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthInboxSyncSchemaReady } from "@/lib/growth/inbox-sync/inbox-sync-schema-health"
import { runInboxSyncForMailbox } from "@/lib/growth/inbox-sync/inbox-sync-runner"
import { GROWTH_INBOX_SYNC_PRIVACY_NOTE } from "@/lib/growth/inbox-sync/inbox-sync-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  mailboxConnectionId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthInboxSyncSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox sync migration." }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid sync payload." }, { status: 400 })
  }

  if (!parsed.data.mailboxConnectionId) {
    return NextResponse.json({ error: "mailbox_required", message: "mailboxConnectionId is required." }, { status: 400 })
  }

  try {
    const result = await runInboxSyncForMailbox(access.admin, {
      mailboxConnectionId: parsed.data.mailboxConnectionId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, result, privacy_note: GROWTH_INBOX_SYNC_PRIVACY_NOTE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox sync failed."
    return NextResponse.json({ error: "sync_failed", message }, { status: 500 })
  }
}
