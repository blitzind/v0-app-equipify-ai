import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { saveProviderCredentialSettings } from "@/lib/growth/provider-setup/dashboard"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : ""
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "api_key is required." },
      { status: 400 },
    )
  }

  const settings = await saveProviderCredentialSettings(access.admin, {
    providerFamily: "resend",
    senderAccountId: typeof body.sender_account_id === "string" ? body.sender_account_id : null,
    actorUserId: access.userId,
    credentials: {
      api_key: apiKey,
      from_email: body.from_email ?? null,
    },
  })

  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, settings })
}
