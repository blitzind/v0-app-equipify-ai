import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { logGrowthGoogleOAuthFlow } from "@/lib/growth/provider-setup/google-oauth-flow-log"
import { buildGoogleProviderAuthorizeUrl, getGoogleOAuthScopes, googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import {
  type GrowthProviderOAuthWorkspace,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"
import {
  createProviderSetupOAuthNonce,
  createProviderSetupOAuthStateRecord,
  normalizeProviderSetupReturnTo,
  signProviderSetupOAuthState,
} from "@/lib/growth/provider-setup/oauth-state"
import { recordProviderSecretAuditEvent } from "@/lib/growth/provider-setup/provider-setup-events"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!googleProviderOAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured", message: "Google OAuth env vars are not configured." },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    return_to?: string
    sender_account_id?: string
    mailbox_connection_id?: string
    workspace?: GrowthProviderOAuthWorkspace
  }

  const senderAccountId = body.sender_account_id?.trim() || null
  const mailboxConnectionId = body.mailbox_connection_id?.trim() || null
  const workspace: GrowthProviderOAuthWorkspace = body.workspace === "admin" ? "admin" : "growth"
  const organizationId = getGrowthEngineAiOrgId()

  let loginHint: string | null = null
  if (mailboxConnectionId) {
    const { getMailboxConnection } = await import("@/lib/growth/mailboxes/mailbox-repository")
    const mailbox = await getMailboxConnection(access.admin, mailboxConnectionId)
    loginHint = mailbox?.email_address ?? null
  } else if (senderAccountId) {
    const { getMailboxConnectionBySender } = await import("@/lib/growth/mailboxes/mailbox-repository")
    const { getSenderAccount } = await import("@/lib/growth/sender/sender-repository")
    const mailbox = await getMailboxConnectionBySender(access.admin, senderAccountId)
    const sender = await getSenderAccount(access.admin, senderAccountId)
    loginHint = mailbox?.email_address ?? sender?.email_address ?? null
  }

  const statePayload = {
    userId: access.userId,
    providerFamily: "google" as const,
    returnTo: normalizeProviderSetupReturnTo(body.return_to, workspace),
    senderAccountId: senderAccountId,
    mailboxConnectionId: mailboxConnectionId,
    workspace,
    organizationId,
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
    providerFamily: "google",
    userId: access.userId,
    returnTo: statePayload.returnTo,
    senderAccountId: statePayload.senderAccountId,
    mailboxConnectionId: statePayload.mailboxConnectionId,
    workspace: statePayload.workspace,
    organizationId: statePayload.organizationId,
    stateToken: state,
  })

  await upsertProviderConnectionSettings(access.admin, {
    provider_family: "google",
    status: "pending",
    ...(statePayload.senderAccountId ? { sender_account_id: statePayload.senderAccountId } : {}),
    ...(statePayload.mailboxConnectionId ? { mailbox_connection_id: statePayload.mailboxConnectionId } : {}),
    actorUserId: access.userId,
  })

  await recordProviderSecretAuditEvent(access.admin, {
    providerFamily: "google",
    action: "oauth_reconnect_started",
    actorUserId: access.userId,
  })

  logGrowthGoogleOAuthFlow("oauth_start", {
    userId: access.userId,
    senderId: statePayload.senderAccountId,
    mailboxId: statePayload.mailboxConnectionId,
    provider: "google",
    connectionState: "pending",
    returnTo: statePayload.returnTo,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    authorize_url: buildGoogleProviderAuthorizeUrl({ state, loginHint }),
    scopes: getGoogleOAuthScopes(),
  })
}
