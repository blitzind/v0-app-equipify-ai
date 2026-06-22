import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { ensureMailboxConnectionForSender } from "@/lib/growth/mailboxes/mailbox-onboarding-service"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"

export const runtime = "nodejs"

const PrepareSchema = z.object({
  senderId: z.string().uuid(),
})

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PrepareSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid prepare payload." }, { status: 400 })
  }

  try {
    const result = await ensureMailboxConnectionForSender(access.admin, {
      senderId: parsed.data.senderId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare mailbox connection."
    const status = message === "sender_not_found" ? 404 : 500
    return NextResponse.json({ error: "onboard_prepare_failed", message }, { status })
  }
}
