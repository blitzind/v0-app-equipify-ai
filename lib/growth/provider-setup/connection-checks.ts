import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getTransportAdapter } from "@/lib/growth/providers/adapters/adapter-registry"
import { simulateTransportForSender } from "@/lib/growth/providers/transport/transport-orchestrator"
import { decryptMailboxToken } from "@/lib/growth/mailboxes/mailbox-token-manager"
import { getMailboxConnection } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  buildCredentialSummary,
  credentialsPresent,
  decryptProviderSetupCredentials,
} from "@/lib/growth/provider-setup/credential-vault"
import {
  googleProviderOAuthConfigured,
  refreshGoogleProviderAccessToken,
} from "@/lib/growth/provider-setup/google-oauth"
import {
  microsoftProviderOAuthConfigured,
  refreshMicrosoftProviderAccessToken,
} from "@/lib/growth/provider-setup/microsoft-oauth"
import {
  recordProviderConnectionCheck,
  recordProviderSecretAuditEvent,
} from "@/lib/growth/provider-setup/provider-setup-events"
import type {
  GrowthProviderConnectionCheckResult,
  GrowthProviderSetupFamily,
} from "@/lib/growth/provider-setup/provider-setup-types"
import { getProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveAdapterCredentials(
  admin: SupabaseClient,
  family: GrowthProviderSetupFamily,
  settings: NonNullable<Awaited<ReturnType<typeof getProviderConnectionSettings>>>,
): Promise<Record<string, unknown>> {
  const decrypted = decryptProviderSetupCredentials(settings.encrypted_credentials)
  if (decrypted) return decrypted

  if ((family === "google" || family === "microsoft") && settings.mailbox_connection_id) {
    const mailbox = await getMailboxConnection(admin, settings.mailbox_connection_id)
    if (!mailbox) return {}
    const { data } = await admin
      .schema("growth")
      .from("mailbox_connections")
      .select("encrypted_access_token, encrypted_refresh_token")
      .eq("id", settings.mailbox_connection_id)
      .maybeSingle()
    const accessToken = decryptMailboxToken(asString(data?.encrypted_access_token))
    return accessToken ? { access_token: accessToken } : {}
  }

  return {}
}

export async function runProviderConnectionTest(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    actorUserId: string
  },
): Promise<GrowthProviderConnectionCheckResult> {
  const settings = await getProviderConnectionSettings(admin, input.providerFamily)
  if (!settings) {
    return { check_type: "test_connection", status: "failed", message: "Provider is not configured." }
  }

  if (input.providerFamily === "google" && !googleProviderOAuthConfigured()) {
    return { check_type: "test_connection", status: "failed", message: "Google OAuth env vars missing." }
  }
  if (input.providerFamily === "microsoft" && !microsoftProviderOAuthConfigured()) {
    return { check_type: "test_connection", status: "failed", message: "Microsoft OAuth env vars missing." }
  }

  const credentials = await resolveAdapterCredentials(admin, input.providerFamily, settings)
  const hasCreds =
    credentialsPresent(settings.encrypted_credentials) ||
    Boolean(credentials.access_token) ||
    Boolean(credentials.api_key) ||
    Boolean(credentials.host)

  if (!hasCreds) {
    const result = { check_type: "test_connection" as const, status: "failed" as const, message: "No credentials available for test." }
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_connection",
      status: result.status,
      message: result.message,
      actorUserId: input.actorUserId,
    })
    return result
  }

  const simulate = process.env.GROWTH_TRANSPORT_SIMULATE?.trim() === "true"
  if (simulate) {
    const result = {
      check_type: "test_connection" as const,
      status: "passed" as const,
      message: "Simulated connection test passed (GROWTH_TRANSPORT_SIMULATE=true).",
      details: { simulated: true, credential_summary: buildCredentialSummary(input.providerFamily, settings.encrypted_credentials) },
    }
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_connection",
      status: result.status,
      message: result.message,
      actorUserId: input.actorUserId,
      details: result.details,
    })
    await recordProviderSecretAuditEvent(admin, {
      providerFamily: input.providerFamily,
      action: "test_connection",
      actorUserId: input.actorUserId,
      metadata: { simulated: true },
    })
    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({
        status: "connected",
        last_connection_check_at: new Date().toISOString(),
      })
      .eq("provider_family", input.providerFamily)
    return result
  }

  const adapter = getTransportAdapter(input.providerFamily)
  if (!adapter) {
    return { check_type: "test_connection", status: "failed", message: "Transport adapter not registered." }
  }

  try {
    const validation = adapter.validate(credentials as never)
    const result: GrowthProviderConnectionCheckResult = validation.ok
      ? {
          check_type: "test_connection",
          status: "passed",
          message: validation.summary ?? "Connection test passed.",
          details: { provider_family: input.providerFamily },
        }
      : {
          check_type: "test_connection",
          status: "failed",
          message: validation.summary ?? "Connection test failed.",
        }

    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_connection",
      status: result.status,
      message: result.message,
      actorUserId: input.actorUserId,
      details: result.details,
    })
    await recordProviderSecretAuditEvent(admin, {
      providerFamily: input.providerFamily,
      action: "test_connection",
      actorUserId: input.actorUserId,
    })
    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({
        status: result.status === "passed" ? "connected" : "failed",
        last_connection_check_at: new Date().toISOString(),
      })
      .eq("provider_family", input.providerFamily)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : "connection_test_failed"
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_connection",
      status: "failed",
      message,
      actorUserId: input.actorUserId,
    })
    return { check_type: "test_connection", status: "failed", message }
  }
}

export async function refreshProviderOAuthTokenStatus(
  admin: SupabaseClient,
  input: { providerFamily: "google" | "microsoft"; actorUserId: string },
): Promise<GrowthProviderConnectionCheckResult> {
  const settings = await getProviderConnectionSettings(admin, input.providerFamily)
  if (!settings?.mailbox_connection_id) {
    return { check_type: "token_refresh", status: "skipped", message: "No mailbox connection linked." }
  }

  const { data } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("encrypted_refresh_token, encrypted_access_token")
    .eq("id", settings.mailbox_connection_id)
    .maybeSingle()

  const refreshToken = decryptMailboxToken(asString(data?.encrypted_refresh_token))
  if (!refreshToken) {
    return { check_type: "token_refresh", status: "failed", message: "Refresh token unavailable." }
  }

  if (process.env.GROWTH_TRANSPORT_SIMULATE?.trim() === "true") {
    const now = new Date().toISOString()
    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({ last_refresh_at: now, last_refresh_status: "simulated_ok", status: "connected" })
      .eq("provider_family", input.providerFamily)
    return { check_type: "token_refresh", status: "passed", message: "Simulated token refresh OK." }
  }

  try {
    const tokens =
      input.providerFamily === "google"
        ? await refreshGoogleProviderAccessToken(refreshToken)
        : await refreshMicrosoftProviderAccessToken(refreshToken)
    const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString()
    await admin
      .schema("growth")
      .from("mailbox_connections")
      .update({
        encrypted_access_token: tokens.access_token
          ? (await import("@/lib/growth/mailboxes/mailbox-token-manager")).encryptMailboxToken(tokens.access_token)
          : undefined,
        token_expires_at: expiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.mailbox_connection_id)

    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({
        token_expires_at: expiresAt,
        last_refresh_at: new Date().toISOString(),
        last_refresh_status: "ok",
        status: "connected",
      })
      .eq("provider_family", input.providerFamily)

    const result = { check_type: "token_refresh" as const, status: "passed" as const, message: "Token refreshed." }
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "token_refresh",
      status: "passed",
      message: result.message,
      actorUserId: input.actorUserId,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_refresh_failed"
    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({
        last_refresh_at: new Date().toISOString(),
        last_refresh_status: "failed",
        status: "expired",
      })
      .eq("provider_family", input.providerFamily)
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "token_refresh",
      status: "failed",
      message,
      actorUserId: input.actorUserId,
    })
    return { check_type: "token_refresh", status: "failed", message }
  }
}

export async function runProviderTransportSimulationCheck(
  admin: SupabaseClient,
  input: { senderAccountId: string; actorUserId: string },
): Promise<GrowthProviderConnectionCheckResult> {
  try {
    const simulation = await simulateTransportForSender(admin, {
      sender_account_id: input.senderAccountId,
      volume: 1,
    })
    return {
      check_type: "readiness",
      status: simulation.selected_route_id ? "passed" : "warning",
      message: simulation.selected_route_id
        ? "Transport route simulation succeeded."
        : "No enabled transport route for sender.",
      details: simulation as unknown as Record<string, unknown>,
    }
  } catch (error) {
    return {
      check_type: "readiness",
      status: "failed",
      message: error instanceof Error ? error.message : "transport_simulation_failed",
    }
  }
}
