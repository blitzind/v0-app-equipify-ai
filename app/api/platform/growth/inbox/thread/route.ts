import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createInboxThread } from "@/lib/growth/inbox/thread-repository"
import { isGrowthUnifiedInboxSchemaReady } from "@/lib/growth/inbox/inbox-schema-health"

export const runtime = "nodejs"

const CreateThreadSchema = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().max(500).optional(),
  providerFamily: z.string().trim().max(120).optional(),
  mailboxConnectionId: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthUnifiedInboxSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateThreadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid inbox thread payload." }, { status: 400 })
  }

  try {
    const thread = await createInboxThread(access.admin, {
      lead_id: parsed.data.leadId,
      subject: parsed.data.subject,
      provider_family: parsed.data.providerFamily,
      mailbox_connection_id: parsed.data.mailboxConnectionId ?? null,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, thread }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create inbox thread."
    const status = message === "lead_not_found" ? 404 : 500
    return NextResponse.json({ error: "inbox_thread_create_failed", message }, { status })
  }
}
