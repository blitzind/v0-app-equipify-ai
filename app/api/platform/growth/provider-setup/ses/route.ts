import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { saveProviderCredentialSettings } from "@/lib/growth/provider-setup/dashboard"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const accessKeyId = typeof body.access_key_id === "string" ? body.access_key_id.trim() : ""
  const secretAccessKey = typeof body.secret_access_key === "string" ? body.secret_access_key : ""
  const region = typeof body.region === "string" ? body.region.trim() : ""
  if (!accessKeyId || !secretAccessKey || !region) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        message: "access_key_id, secret_access_key, and region are required.",
      },
      { status: 400 },
    )
  }

  const settings = await saveProviderCredentialSettings(access.admin, {
    providerFamily: "ses",
    senderAccountId: typeof body.sender_account_id === "string" ? body.sender_account_id : null,
    actorUserId: access.userId,
    credentials: {
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      region,
      from_email: body.from_email ?? null,
    },
  })

  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, settings })
}
