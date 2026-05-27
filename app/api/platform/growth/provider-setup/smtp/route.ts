import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { saveProviderCredentialSettings } from "@/lib/growth/provider-setup/dashboard"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const host = typeof body.host === "string" ? body.host.trim() : ""
  const username = typeof body.username === "string" ? body.username.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  if (!host || !username || !password) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "host, username, and password are required." },
      { status: 400 },
    )
  }

  const settings = await saveProviderCredentialSettings(access.admin, {
    providerFamily: "smtp",
    senderAccountId: typeof body.sender_account_id === "string" ? body.sender_account_id : null,
    actorUserId: access.userId,
    credentials: {
      host,
      port: body.port ?? 587,
      username,
      password,
      from_email: body.from_email ?? username,
      secure: body.secure === true,
    },
  })

  return NextResponse.json({ ok: true, qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, settings })
}
