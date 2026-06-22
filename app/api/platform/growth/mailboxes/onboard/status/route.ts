import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { buildMailboxOnboardingStatus } from "@/lib/growth/mailboxes/mailbox-onboarding-service"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const senderId = new URL(request.url).searchParams.get("senderId")?.trim() ?? ""
  if (!senderId) {
    return NextResponse.json({ error: "validation_error", message: "senderId is required." }, { status: 400 })
  }

  try {
    const status = await buildMailboxOnboardingStatus(access.admin, senderId)
    if (!status) {
      return NextResponse.json({ error: "sender_not_found", message: "Sender not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    return NextResponse.json(
      {
        error: "onboard_status_failed",
        message: error instanceof Error ? error.message : "Could not load onboarding status.",
      },
      { status: 500 },
    )
  }
}
