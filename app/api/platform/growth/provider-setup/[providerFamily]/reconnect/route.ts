import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { refreshProviderOAuthTokenStatus } from "@/lib/growth/provider-setup/connection-checks"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"
import { buildGoogleProviderAuthorizeUrl, googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
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
import {
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
  isGrowthProviderSetupFamily,
} from "@/lib/growth/provider-setup/provider-setup-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ providerFamily: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const { providerFamily } = await context.params
  if (!isGrowthProviderSetupFamily(providerFamily)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "refresh" | "oauth"
    return_to?: string
    sender_account_id?: string
  }

  if (providerFamily === "google" || providerFamily === "microsoft") {
    if (body.mode === "oauth") {
      const configured =
        providerFamily === "google" ? googleProviderOAuthConfigured() : microsoftProviderOAuthConfigured()
      if (!configured) {
        return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
      }

      const statePayload = {
        userId: access.userId,
        providerFamily,
        returnTo: normalizeProviderSetupReturnTo(body.return_to),
        senderAccountId: body.sender_account_id?.trim() || null,
        ts: Date.now(),
        nonce: createProviderSetupOAuthNonce(),
      }
      const state = signProviderSetupOAuthState(statePayload)
      if (!state) {
        return NextResponse.json({ ok: false, error: "state_signing_failed" }, { status: 503 })
      }

      await createProviderSetupOAuthStateRecord(access.admin, {
        providerFamily,
        userId: access.userId,
        returnTo: statePayload.returnTo,
        senderAccountId: statePayload.senderAccountId,
        stateToken: state,
      })
      await upsertProviderConnectionSettings(access.admin, {
        provider_family: providerFamily,
        status: "pending",
        sender_account_id: statePayload.senderAccountId,
        actorUserId: access.userId,
      })
      await recordProviderSecretAuditEvent(access.admin, {
        providerFamily,
        action: "reconnect",
        actorUserId: access.userId,
      })

      return NextResponse.json({
        ok: true,
        qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
        authorize_url:
          providerFamily === "google"
            ? buildGoogleProviderAuthorizeUrl({ state })
            : buildMicrosoftProviderAuthorizeUrl({ state }),
      })
    }

    const result = await refreshProviderOAuthTokenStatus(access.admin, {
      providerFamily,
      actorUserId: access.userId,
    })
    await recordProviderSecretAuditEvent(access.admin, {
      providerFamily,
      action: "reconnect",
      actorUserId: access.userId,
      metadata: { mode: "refresh" },
    })
    return NextResponse.json({ ok: result.status === "passed", qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, result })
  }

  await upsertProviderConnectionSettings(access.admin, {
    provider_family: providerFamily,
    status: "pending",
    actorUserId: access.userId,
  })
  await recordProviderSecretAuditEvent(access.admin, {
    providerFamily,
    action: "reconnect",
    actorUserId: access.userId,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    message: "Re-save credentials to reconnect this provider.",
  })
}
