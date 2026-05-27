import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { addInboxMessage } from "@/lib/growth/inbox/thread-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"
import { GROWTH_INBOX_MESSAGE_DIRECTIONS } from "@/lib/growth/inbox/inbox-types"

export const runtime = "nodejs"

const AddMessageSchema = z.object({
  threadId: z.string().uuid(),
  direction: z.enum(GROWTH_INBOX_MESSAGE_DIRECTIONS),
  sender: z.string().trim().max(320).optional(),
  recipient: z.string().trim().max(320).optional(),
  subject: z.string().trim().max(500).optional(),
  bodyPreview: z.string().trim().max(4000).optional(),
  providerMessageId: z.string().trim().max(500).nullable().optional(),
  messageTimestamp: z.string().datetime().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = AddMessageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid inbox message payload." }, { status: 400 })
  }

  try {
    const result = await addInboxMessage(access.admin, {
      thread_id: parsed.data.threadId,
      direction: parsed.data.direction,
      sender: parsed.data.sender,
      recipient: parsed.data.recipient,
      subject: parsed.data.subject,
      body_preview: parsed.data.bodyPreview,
      provider_message_id: parsed.data.providerMessageId ?? null,
      message_timestamp: parsed.data.messageTimestamp,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add inbox message."
    const status = message === "inbox_thread_not_found" ? 404 : 500
    return NextResponse.json({ error: "inbox_message_create_failed", message }, { status })
  }
}
