import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGoogleProviderAuthorizeUrl, getGoogleOAuthScopes, googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
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
  }

  const senderAccountId = body.sender_account_id?.trim() || null
  const mailboxConnectionId = body.mailbox_connection_id?.trim() || null

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
    returnTo: normalizeProviderSetupReturnTo(body.return_to),
    senderAccountId: senderAccountId,
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
    stateToken: state,
  })

  await upsertProviderConnectionSettings(access.admin, {
    provider_family: "google",
    status: "pending",
    sender_account_id: statePayload.senderAccountId,
    actorUserId: access.userId,
  })

  await recordProviderSecretAuditEvent(access.admin, {
    providerFamily: "google",
    action: "oauth_reconnect_started",
    actorUserId: access.userId,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    authorize_url: buildGoogleProviderAuthorizeUrl({ state, loginHint }),
    scopes: getGoogleOAuthScopes(),
  })
}
