import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCredentialSummary,
  credentialsPresent,
  encryptProviderSetupCredentials,
  sanitizeProviderSetupForApi,
} from "@/lib/growth/provider-setup/credential-vault"
import { recordProviderSecretAuditEvent } from "@/lib/growth/provider-setup/provider-setup-events"
import {
  collectProviderSetupEnvWarnings,
  computeProviderSetupReadiness,
  getTrackingBaseUrl,
  persistProviderSetupReadinessSnapshot,
} from "@/lib/growth/provider-setup/readiness-checklist"
import {
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
  type GrowthProviderCredentialInput,
  type GrowthProviderSetupDashboard,
  type GrowthProviderSetupFamily,
  type GrowthProviderSetupReadinessResult,
  providerSetupFamilyLabel,
} from "@/lib/growth/provider-setup/provider-setup-types"
import { logGrowthGoogleOAuthFlow } from "@/lib/growth/provider-setup/google-oauth-flow-log"
import {
  GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_SETUP_MESSAGE,
  isGrowthLiveProviderSetupSchemaReady,
} from "@/lib/growth/provider-setup/schema-health"

type SettingsRow = Record<string, unknown>

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_connection_settings")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapSettingsRow(row: SettingsRow) {
  return sanitizeProviderSetupForApi({
    id: asString(row.id),
    provider_family: asString(row.provider_family) as GrowthProviderSetupFamily,
    status: asString(row.status),
    sender_account_id: asString(row.sender_account_id) || null,
    mailbox_connection_id: asString(row.mailbox_connection_id) || null,
    delivery_provider_id: asString(row.delivery_provider_id) || null,
    webhook_endpoint_id: asString(row.webhook_endpoint_id) || null,
    oauth_account_email: asString(row.oauth_account_email) || null,
    token_expires_at: asString(row.token_expires_at) || null,
    last_refresh_at: asString(row.last_refresh_at) || null,
    last_refresh_status: asString(row.last_refresh_status) || null,
    last_connection_check_at: asString(row.last_connection_check_at) || null,
    last_test_send_at: asString(row.last_test_send_at) || null,
    config_warnings: Array.isArray(row.config_warnings) ? row.config_warnings : [],
    credential_summary: buildCredentialSummary(
      asString(row.provider_family) as GrowthProviderSetupFamily,
      asString(row.encrypted_credentials) || null,
    ),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    updated_at: asString(row.updated_at),
  })
}

export type ProviderConnectionSettingsRecord = {
  provider_family: GrowthProviderSetupFamily
  status: string
  sender_account_id: string | null
  mailbox_connection_id: string | null
  delivery_provider_id: string | null
  webhook_endpoint_id: string | null
  oauth_account_email: string | null
  encrypted_credentials: string | null
  token_expires_at: string | null
  last_refresh_at: string | null
  last_refresh_status: string | null
  last_test_send_at: string | null
}

export async function listProviderConnectionSettingsRows(
  admin: SupabaseClient,
): Promise<ProviderConnectionSettingsRecord[]> {
  if (!(await isGrowthLiveProviderSetupSchemaReady(admin))) return []
  const { data, error } = await settingsTable(admin).select("*").order("provider_family")
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    provider_family: asString(row.provider_family) as GrowthProviderSetupFamily,
    status: asString(row.status) || "not_configured",
    sender_account_id: asString(row.sender_account_id) || null,
    mailbox_connection_id: asString(row.mailbox_connection_id) || null,
    delivery_provider_id: asString(row.delivery_provider_id) || null,
    webhook_endpoint_id: asString(row.webhook_endpoint_id) || null,
    oauth_account_email: asString(row.oauth_account_email) || null,
    encrypted_credentials: asString(row.encrypted_credentials) || null,
    token_expires_at: asString(row.token_expires_at) || null,
    last_refresh_at: asString(row.last_refresh_at) || null,
    last_refresh_status: asString(row.last_refresh_status) || null,
    last_test_send_at: asString(row.last_test_send_at) || null,
  }))
}

export async function getProviderConnectionSettings(
  admin: SupabaseClient,
  providerFamily: GrowthProviderSetupFamily,
): Promise<ProviderConnectionSettingsRecord | null> {
  const rows = await listProviderConnectionSettingsRows(admin)
  return rows.find((row) => row.provider_family === providerFamily) ?? null
}

export async function upsertProviderConnectionSettings(
  admin: SupabaseClient,
  input: {
    provider_family: GrowthProviderSetupFamily
    status?: string
    sender_account_id?: string | null
    mailbox_connection_id?: string | null
    delivery_provider_id?: string | null
    webhook_endpoint_id?: string | null
    oauth_account_email?: string | null
    oauth_scopes?: string[]
    encrypted_credentials?: string | null
    token_expires_at?: string | null
    last_refresh_at?: string | null
    last_refresh_status?: string | null
    last_connection_check_at?: string | null
    last_test_send_at?: string | null
    config_warnings?: string[]
    metadata?: Record<string, unknown>
    actorUserId?: string | null
  },
): Promise<ReturnType<typeof mapSettingsRow>> {
  if (!(await isGrowthLiveProviderSetupSchemaReady(admin))) {
    throw new Error(GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_SETUP_MESSAGE)
  }

  const existing = await getProviderConnectionSettings(admin, input.provider_family)
  const patch: Record<string, unknown> = {
    provider_family: input.provider_family,
    updated_at: new Date().toISOString(),
  }
  if (input.status != null) patch.status = input.status
  if (input.sender_account_id !== undefined) patch.sender_account_id = input.sender_account_id
  if (input.mailbox_connection_id !== undefined) patch.mailbox_connection_id = input.mailbox_connection_id
  if (input.delivery_provider_id !== undefined) patch.delivery_provider_id = input.delivery_provider_id
  if (input.webhook_endpoint_id !== undefined) patch.webhook_endpoint_id = input.webhook_endpoint_id
  if (input.oauth_account_email !== undefined) patch.oauth_account_email = input.oauth_account_email
  if (input.oauth_scopes) patch.oauth_scopes = input.oauth_scopes
  if (input.encrypted_credentials !== undefined) patch.encrypted_credentials = input.encrypted_credentials
  if (input.token_expires_at !== undefined) patch.token_expires_at = input.token_expires_at
  if (input.last_refresh_at !== undefined) patch.last_refresh_at = input.last_refresh_at
  if (input.last_refresh_status !== undefined) patch.last_refresh_status = input.last_refresh_status
  if (input.last_connection_check_at !== undefined) patch.last_connection_check_at = input.last_connection_check_at
  if (input.last_test_send_at !== undefined) patch.last_test_send_at = input.last_test_send_at
  if (input.config_warnings) patch.config_warnings = input.config_warnings
  if (input.metadata) patch.metadata = input.metadata
  if (!existing && input.actorUserId) patch.created_by = input.actorUserId
  if (!existing && !input.status) patch.status = "pending"

  const { data, error } = await settingsTable(admin)
    .upsert(patch, { onConflict: "provider_family" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSettingsRow(data as SettingsRow)
}

export async function saveProviderCredentialSettings(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    credentials: GrowthProviderCredentialInput
    senderAccountId?: string | null
    actorUserId: string
  },
): Promise<ReturnType<typeof mapSettingsRow>> {
  const encrypted = encryptProviderSetupCredentials(input.credentials)
  const row = await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    encrypted_credentials: encrypted,
    sender_account_id: input.senderAccountId ?? null,
    status: "connected",
    actorUserId: input.actorUserId,
  })
  await syncDeliveryProviderFromSetup(admin, {
    providerFamily: input.providerFamily,
    encryptedCredentials: encrypted,
    actorUserId: input.actorUserId,
  })
  await recordProviderSecretAuditEvent(admin, {
    providerFamily: input.providerFamily,
    action: "credentials_updated",
    actorUserId: input.actorUserId,
    metadata: { fields: Object.keys(input.credentials).filter((key) => !/secret|token|password|key/i.test(key)) },
  })
  return row
}

async function syncDeliveryProviderFromSetup(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    encryptedCredentials: string
    actorUserId: string
  },
): Promise<void> {
  if (input.providerFamily === "custom") return
  const { listDeliveryProviders, createDeliveryProvider, updateDeliveryProvider } = await import(
    "@/lib/growth/providers/provider-repository"
  )
  const providers = await listDeliveryProviders(admin)
  const existing = providers.find((provider) => provider.provider_family === input.providerFamily)
  if (!existing) {
    const created = await createDeliveryProvider(admin, {
      provider_key: `setup_${input.providerFamily}`,
      provider_name: providerSetupFamilyLabel(input.providerFamily),
      provider_family: input.providerFamily as never,
      status: "connected",
      actorUserId: input.actorUserId,
    })
    await admin
      .schema("growth")
      .from("delivery_providers")
      .update({
        metadata: { encrypted_credentials: input.encryptedCredentials, configured_via: "provider_setup" },
        configuration_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id)
    await upsertProviderConnectionSettings(admin, {
      provider_family: input.providerFamily,
      delivery_provider_id: created.id,
      actorUserId: input.actorUserId,
    })
    return
  }

  await admin
    .schema("growth")
    .from("delivery_providers")
    .update({
      metadata: {
        ...(existing.metadata ?? {}),
        encrypted_credentials: input.encryptedCredentials,
        configured_via: "provider_setup",
      },
      configuration_status: "ready",
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
  await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    delivery_provider_id: existing.id,
    actorUserId: input.actorUserId,
  })
  await updateDeliveryProvider(admin, existing.id, {
    status: "connected",
    configuration_status: "ready",
    actorUserId: input.actorUserId,
  }).catch(() => undefined)
}

export async function disableProviderConnectionSettings(
  admin: SupabaseClient,
  input: { providerFamily: GrowthProviderSetupFamily; actorUserId: string },
): Promise<ReturnType<typeof mapSettingsRow>> {
  const row = await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    status: "disabled",
    actorUserId: input.actorUserId,
  })
  await recordProviderSecretAuditEvent(admin, {
    providerFamily: input.providerFamily,
    action: "disabled",
    actorUserId: input.actorUserId,
  })
  return row
}

export async function fetchProviderSetupDashboard(
  admin: SupabaseClient,
  origin: string,
): Promise<GrowthProviderSetupDashboard> {
  const rows = await listProviderConnectionSettingsRows(admin)
  const { families, global } = await computeProviderSetupReadiness(admin, rows as never)
  await persistProviderSetupReadinessSnapshot(admin, families, global).catch(() => undefined)

  return {
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    env_warnings: collectProviderSetupEnvWarnings(),
    tracking_base_url: getTrackingBaseUrl(),
    families,
    global_readiness: global,
    webhook_url_template: `${origin.replace(/\/$/, "")}/api/growth/webhooks/provider/{providerFamily}`,
  }
}

export async function fetchProviderSetupReadiness(
  admin: SupabaseClient,
): Promise<GrowthProviderSetupReadinessResult> {
  const dashboard = await fetchProviderSetupDashboard(admin, "https://example.local")
  return {
    qa_marker: GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
    families: dashboard.families.flatMap((family) => family.readiness_checks),
    global: dashboard.global_readiness,
  }
}

export async function completeOAuthProviderConnection(
  admin: SupabaseClient,
  input: {
    providerFamily: "google" | "microsoft"
    senderAccountId: string | null
    mailboxConnectionId?: string | null
    email: string
    displayName?: string | null
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string
    scopes: string[]
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<{ settings: ReturnType<typeof mapSettingsRow>; mailbox_connection_id: string }> {
  const {
    createMailboxConnection,
    updateMailboxConnection,
    getMailboxConnection,
    getMailboxConnectionBySender,
    validateMailboxConnection,
  } = await import("@/lib/growth/mailboxes/mailbox-repository")
  const { appendMailboxTimelineEvent } = await import("@/lib/growth/mailboxes/mailbox-events")

  let mailboxId: string | null = null

  if (input.mailboxConnectionId) {
    const mailbox = await getMailboxConnection(admin, input.mailboxConnectionId)
    if (mailbox && mailbox.provider_family === input.providerFamily) {
      mailboxId = mailbox.id
    }
  }

  if (!mailboxId && input.senderAccountId) {
    const bySender = await getMailboxConnectionBySender(admin, input.senderAccountId)
    if (bySender && bySender.provider_family === input.providerFamily) {
      mailboxId = bySender.id
    }
  }

  if (!mailboxId) {
    const existing = await getProviderConnectionSettings(admin, input.providerFamily)
    if (existing?.mailbox_connection_id) {
      mailboxId = existing.mailbox_connection_id
    }
  }

  let resolvedSenderAccountId = input.senderAccountId
  if (!resolvedSenderAccountId && mailboxId) {
    const linkedMailbox = await getMailboxConnection(admin, mailboxId)
    resolvedSenderAccountId = linkedMailbox?.sender_account_id ?? null
  }

  const tokenPatch = {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expires_at: input.tokenExpiresAt,
    display_name: input.displayName ?? input.email,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  }

  if (mailboxId) {
    await updateMailboxConnection(admin, mailboxId, {
      ...tokenPatch,
      status: "connecting",
      validation_failure_count: 0,
    })
  } else if (resolvedSenderAccountId) {
    const mailbox = await createMailboxConnection(admin, {
      sender_account_id: resolvedSenderAccountId,
      provider_family: input.providerFamily,
      email_address: input.email,
      display_name: input.displayName ?? input.email,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: input.tokenExpiresAt,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
    mailboxId = mailbox.id
  } else {
    throw new Error("sender_account_id is required for first OAuth connection.")
  }

  const validated = await validateMailboxConnection(admin, mailboxId, {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  if (validated.status !== "connected") {
    await appendMailboxTimelineEvent(admin, {
      eventType: "mailbox_validation_failed",
      title: `OAuth reconnect validation: ${validated.email_address}`,
      summary: validated.health_reason ?? "Mailbox validation did not reach connected status.",
      mailboxConnectionId: mailboxId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      payload: { oauth: true, status: validated.status },
    })
    throw new Error(validated.health_reason ?? "Mailbox validation failed after OAuth reconnect.")
  }

  const settings = await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    status: "connected",
    ...(resolvedSenderAccountId ? { sender_account_id: resolvedSenderAccountId } : {}),
    mailbox_connection_id: mailboxId,
    oauth_account_email: input.email,
    oauth_scopes: input.scopes,
    token_expires_at: input.tokenExpiresAt,
    last_refresh_at: new Date().toISOString(),
    last_refresh_status: "connected",
    actorUserId: input.actorUserId,
  })

  await recordProviderSecretAuditEvent(admin, {
    providerFamily: input.providerFamily,
    action: "oauth_connected",
    actorUserId: input.actorUserId,
    metadata: { email: input.email, mailbox_connection_id: mailboxId, reconnect: true },
  })

  await appendMailboxTimelineEvent(admin, {
    eventType: "mailbox_connected",
    title: `Gmail OAuth connected: ${validated.email_address}`,
    summary: "Mailbox OAuth tokens stored and live validation passed (send + inbox read scopes).",
    mailboxConnectionId: mailboxId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    payload: { provider_family: input.providerFamily, scopes: input.scopes },
  })

  if (resolvedSenderAccountId && mailboxId) {
    const { wireOAuthProviderTransportAfterConnection } = await import(
      "@/lib/growth/provider-setup/oauth-transport-auto-wire"
    )
    await wireOAuthProviderTransportAfterConnection(admin, {
      providerFamily: input.providerFamily,
      senderAccountId: resolvedSenderAccountId,
      mailboxConnectionId: mailboxId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
  }

  if (input.providerFamily === "google") {
    logGrowthGoogleOAuthFlow("status_recomputed", {
      userId: input.actorUserId,
      senderId: resolvedSenderAccountId,
      mailboxId,
      email: input.email,
      provider: input.providerFamily,
      connectionState: validated.status,
    })
  }

  return { settings, mailbox_connection_id: mailboxId }
}

export function providerSetupConfigured(settings: ProviderConnectionSettingsRecord | null): boolean {
  if (!settings) return false
  return settings.status === "connected" || credentialsPresent(settings.encrypted_credentials)
}
