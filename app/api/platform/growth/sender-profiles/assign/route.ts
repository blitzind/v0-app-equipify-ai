import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { assignSenderProfileMailbox } from "@/lib/growth/signatures/sender-profile-repository"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"

export const runtime = "nodejs"

const AssignSchema = z.object({
  profileId: z.string().uuid(),
  mailboxConnectionId: z.string().uuid().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = AssignSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid mailbox assignment." }, { status: 400 })
  }

  try {
    const profile = await assignSenderProfileMailbox(
      access.admin,
      parsed.data.profileId,
      parsed.data.mailboxConnectionId,
    )
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign mailbox."
    const status = message === "sender_profile_not_found" ? 404 : 500
    return NextResponse.json({ error: "sender_profile_assign_failed", message }, { status })
  }
}
