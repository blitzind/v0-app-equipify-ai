import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"
import {
  buildMicrosoftProviderAuthorizeUrl,
  microsoftProviderOAuthConfigured,
} from "@/lib/growth/provider-setup/microsoft-oauth"
import {
  createProviderSetupOAuthNonce,
  createProviderSetupOAuthStateRecord,
  normalizeProviderSetupReturnTo,
  signProviderSetupOAuthState,
} from "@/lib/growth/provider-setup/oauth-state"
import { recordProviderSecretAuditEvent } from "@/lib/growth/provider-setup/provider-setup-events"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!microsoftProviderOAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured", message: "Microsoft OAuth env vars are not configured." },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    return_to?: string
    sender_account_id?: string
  }

  const statePayload = {
    userId: access.userId,
    providerFamily: "microsoft" as const,
    returnTo: normalizeProviderSetupReturnTo(body.return_to),
    senderAccountId: body.sender_account_id?.trim() || null,
    ts: Date.now(),
    nonce: createProviderSetupOAuthNonce(),
  }
  const state = signProviderSetupOAuthState(statePayload)
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "state_signing_failed", message: "INTEGRATION_OAUTH_STATE_SECRET is required." },
      { status: 503 },
    )
  }

  await createProviderSetupOAuthStateRecord(access.admin, {
    providerFamily: "microsoft",
    userId: access.userId,
    returnTo: statePayload.returnTo,
    senderAccountId: statePayload.senderAccountId,
    stateToken: state,
  })

  await upsertProviderConnectionSettings(access.admin, {
    provider_family: "microsoft",
    status: "pending",
    sender_account_id: statePayload.senderAccountId,
    actorUserId: access.userId,
  })

  await recordProviderSecretAuditEvent(access.admin, {
    providerFamily: "microsoft",
    action: "oauth_reconnect_started",
    actorUserId: access.userId,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    authorize_url: buildMicrosoftProviderAuthorizeUrl({ state }),
  })
}
