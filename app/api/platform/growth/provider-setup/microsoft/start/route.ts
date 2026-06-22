import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"
import type { GrowthProviderOAuthWorkspace } from "@/lib/growth/navigation/growth-delivery-settings-navigation"
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
    mailbox_connection_id?: string
    workspace?: GrowthProviderOAuthWorkspace
  }

  const workspace: GrowthProviderOAuthWorkspace = body.workspace === "admin" ? "admin" : "growth"
  const senderAccountId = body.sender_account_id?.trim() || null
  const mailboxConnectionId = body.mailbox_connection_id?.trim() || null

  const statePayload = {
    userId: access.userId,
    providerFamily: "microsoft" as const,
    returnTo: normalizeProviderSetupReturnTo(body.return_to, workspace),
    senderAccountId,
    mailboxConnectionId,
    workspace,
    organizationId: getGrowthEngineAiOrgId(),
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
    mailboxConnectionId: statePayload.mailboxConnectionId,
    workspace: statePayload.workspace,
    organizationId: statePayload.organizationId,
    stateToken: state,
  })

  await upsertProviderConnectionSettings(access.admin, {
    provider_family: "microsoft",
    status: "pending",
    ...(statePayload.senderAccountId ? { sender_account_id: statePayload.senderAccountId } : {}),
    ...(statePayload.mailboxConnectionId ? { mailbox_connection_id: statePayload.mailboxConnectionId } : {}),
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
