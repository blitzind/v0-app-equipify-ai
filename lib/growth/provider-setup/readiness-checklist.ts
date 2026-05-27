import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"
import { isGovernanceSchemaReadyForEnforcement } from "@/lib/growth/governance/policy-engine"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"
import { credentialsPresent } from "@/lib/growth/provider-setup/credential-vault"
import {
  googleProviderOAuthConfigured,
  googleProviderOAuthEnvWarnings,
} from "@/lib/growth/provider-setup/google-oauth"
import {
  microsoftProviderOAuthConfigured,
  microsoftProviderOAuthEnvWarnings,
} from "@/lib/growth/provider-setup/microsoft-oauth"
import type {
  GrowthProviderReadinessCheckKey,
  GrowthProviderReadinessStatus,
  GrowthProviderSetupCard,
  GrowthProviderSetupFamily,
  GrowthProviderSetupFamilySummary,
} from "@/lib/growth/provider-setup/provider-setup-types"
import {
  GROWTH_PROVIDER_READINESS_CHECK_KEYS,
  GROWTH_PROVIDER_SETUP_FAMILIES,
  providerSetupFamilyLabel,
} from "@/lib/growth/provider-setup/provider-setup-types"
import { findWebhookEndpointByFamily } from "@/lib/growth/webhooks/webhook-repository"

type SettingsRow = {
  provider_family: string
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
  config_warnings: unknown
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseWarnings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function oauthConfiguredForFamily(family: GrowthProviderSetupFamily): boolean {
  if (family === "google") return googleProviderOAuthConfigured()
  if (family === "microsoft") return microsoftProviderOAuthConfigured()
  return false
}

export function collectProviderSetupEnvWarnings(): string[] {
  const warnings = [...googleProviderOAuthEnvWarnings(), ...microsoftProviderOAuthEnvWarnings()]
  if (!process.env.GROWTH_TRACKING_BASE_URL?.trim() && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    warnings.push("GROWTH_TRACKING_BASE_URL is not configured (tracking links may be unavailable).")
  }
  const pepper =
    process.env.GROWTH_PROVIDER_SECRET_PEPPER?.trim() ||
    process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER?.trim()
  if (!pepper) {
    warnings.push("GROWTH_PROVIDER_SECRET_PEPPER (or GROWTH_PROVIDER_CREDENTIALS_PEPPER) is not configured.")
  }
  return [...new Set(warnings)]
}

export function getTrackingBaseUrl(): string | null {
  return process.env.GROWTH_TRACKING_BASE_URL?.trim() || null
}

async function evaluateGlobalChecks(
  admin: SupabaseClient,
): Promise<Array<{ check_key: GrowthProviderReadinessCheckKey; status: GrowthProviderReadinessStatus; message: string }>> {
  const complianceReady = await isGrowthComplianceSchemaReady(admin)
  const governanceReady = await isGovernanceSchemaReadyForEnforcement(admin)
  const mailboxReady = await isGrowthMailboxConnectionSchemaReady(admin)
  const trackingReady =
    process.env.GROWTH_TRACKING_DISABLED?.trim() === "true" || Boolean(getTrackingBaseUrl())

  return [
    {
      check_key: "compliance_ready",
      status: complianceReady ? "pass" : "warning",
      message: complianceReady ? "Compliance schema ready." : "Compliance schema not applied.",
    },
    {
      check_key: "governance_ready",
      status: governanceReady ? "pass" : "warning",
      message: governanceReady ? "Governance enforcement ready." : "Governance schema not applied.",
    },
    {
      check_key: "mailbox_connected",
      status: mailboxReady ? "pass" : "warning",
      message: mailboxReady ? "Mailbox connection schema ready." : "Mailbox schema not applied.",
    },
    {
      check_key: "tracking_domain_ready",
      status: trackingReady ? "pass" : "warning",
      message: trackingReady
        ? "Tracking domain configured or tracking disabled."
        : "Configure GROWTH_TRACKING_BASE_URL or set GROWTH_TRACKING_DISABLED=true.",
    },
  ]
}

function buildCards(
  family: GrowthProviderSetupFamily,
  row: SettingsRow | null,
  checks: GrowthProviderSetupFamilySummary["readiness_checks"],
): GrowthProviderSetupCard[] {
  const byKey = new Map(checks.map((check) => [check.check_key, check]))
  const status = asString(row?.status) || "not_configured"
  return [
    {
      key: "oauth_status",
      label: "OAuth Status",
      status:
        family === "google" || family === "microsoft"
          ? oauthConfiguredForFamily(family)
            ? status === "connected"
              ? "pass"
              : status === "expired" || status === "failed"
                ? "fail"
                : "warning"
            : "fail"
          : "skipped",
      message:
        family === "google" || family === "microsoft"
          ? oauthConfiguredForFamily(family)
            ? row?.oauth_account_email
              ? `Connected as ${row.oauth_account_email}`
              : "OAuth app configured — connect mailbox."
            : "OAuth env vars missing."
          : "Not applicable.",
    },
    {
      key: "credential_status",
      label: "Credential Status",
      status: credentialsPresent(row?.encrypted_credentials ?? null) ? "pass" : "fail",
      message: credentialsPresent(row?.encrypted_credentials ?? null)
        ? "Encrypted credentials stored."
        : "No credentials saved.",
    },
    {
      key: "mailbox_sync_status",
      label: "Mailbox Sync Status",
      status: row?.mailbox_connection_id ? "pass" : family === "google" || family === "microsoft" ? "warning" : "skipped",
      message: row?.mailbox_connection_id
        ? "Mailbox connection linked."
        : "Mailbox not linked — inbox sync disabled.",
    },
    {
      key: "transport_status",
      label: "Transport Status",
      status:
        status === "connected"
          ? "pass"
          : status === "warning" || status === "pending"
            ? "warning"
            : "fail",
      message: `Connection status: ${status}.`,
    },
    {
      key: "webhook_status",
      label: "Webhook Status",
      status: (byKey.get("webhook_configured")?.status ?? "fail") as GrowthProviderReadinessStatus,
      message: byKey.get("webhook_configured")?.message ?? "Webhook not configured.",
    },
    {
      key: "tracking_status",
      label: "Tracking Status",
      status: (byKey.get("tracking_domain_ready")?.status ?? "warning") as GrowthProviderReadinessStatus,
      message: byKey.get("tracking_domain_ready")?.message ?? "Tracking not verified.",
    },
    {
      key: "compliance_status",
      label: "Compliance Status",
      status: (byKey.get("compliance_ready")?.status ?? "warning") as GrowthProviderReadinessStatus,
      message: byKey.get("compliance_ready")?.message ?? "Compliance readiness unknown.",
    },
    {
      key: "governance_status",
      label: "Governance Status",
      status: (byKey.get("governance_ready")?.status ?? "warning") as GrowthProviderReadinessStatus,
      message: byKey.get("governance_ready")?.message ?? "Governance readiness unknown.",
    },
  ]
}

async function evaluateFamilyChecks(
  admin: SupabaseClient,
  family: GrowthProviderSetupFamily,
  row: SettingsRow | null,
): Promise<GrowthProviderSetupFamilySummary["readiness_checks"]> {
  const global = await evaluateGlobalChecks(admin)
  const globalByKey = new Map(global.map((item) => [item.check_key, item]))
  const webhook = await findWebhookEndpointByFamily(admin, family).catch(() => null)

  const checks: GrowthProviderSetupFamilySummary["readiness_checks"] = GROWTH_PROVIDER_READINESS_CHECK_KEYS.map(
    (check_key) => {
      switch (check_key) {
        case "oauth_configured":
          return {
            check_key,
            status:
              family === "google" || family === "microsoft"
                ? oauthConfiguredForFamily(family)
                  ? "pass"
                  : "fail"
                : "skipped",
            message:
              family === "google" || family === "microsoft"
                ? oauthConfiguredForFamily(family)
                  ? "OAuth application configured."
                  : "OAuth env vars missing."
                : "Not applicable for credential providers.",
          }
        case "credentials_present":
          return {
            check_key,
            status:
              credentialsPresent(row?.encrypted_credentials ?? null) ||
              (family !== "smtp" && family !== "ses" && family !== "resend" && family !== "custom" &&
                Boolean(row?.mailbox_connection_id))
                ? "pass"
                : "fail",
            message: credentialsPresent(row?.encrypted_credentials ?? null)
              ? "Encrypted credentials on file."
              : row?.mailbox_connection_id
                ? "OAuth mailbox tokens stored separately."
                : "Save credentials or complete OAuth.",
          }
        case "sender_connected":
          return {
            check_key,
            status: row?.sender_account_id ? "pass" : "warning",
            message: row?.sender_account_id ? "Sender account linked." : "Link a sender account.",
          }
        case "mailbox_connected":
          return {
            check_key,
            status: row?.mailbox_connection_id ? "pass" : family === "smtp" || family === "ses" || family === "resend" ? "skipped" : "warning",
            message: row?.mailbox_connection_id ? "Mailbox connected." : "Mailbox connection pending.",
          }
        case "dns_valid":
          return {
            check_key,
            status: "warning",
            message: "Verify DNS in Deliverability Ops before high-volume sending.",
          }
        case "webhook_configured":
          return {
            check_key,
            status: webhook ? "pass" : "warning",
            message: webhook ? "Webhook endpoint registered." : "Configure provider webhook endpoint.",
          }
        case "tracking_domain_ready":
          return globalByKey.get("tracking_domain_ready") ?? {
            check_key,
            status: "warning" as const,
            message: "Tracking domain not configured.",
          }
        case "compliance_ready":
          return globalByKey.get("compliance_ready") ?? {
            check_key,
            status: "warning" as const,
            message: "Compliance schema pending.",
          }
        case "governance_ready":
          return globalByKey.get("governance_ready") ?? {
            check_key,
            status: "warning" as const,
            message: "Governance schema pending.",
          }
        case "test_send_passed":
          return {
            check_key,
            status: row?.last_test_send_at ? "pass" : "fail",
            message: row?.last_test_send_at
              ? `Last test send: ${row.last_test_send_at}`
              : "Run a human-confirmed test send.",
          }
        default:
          return { check_key, status: "skipped", message: "Not evaluated." }
      }
    },
  )

  return checks
}

export async function computeProviderSetupReadiness(
  admin: SupabaseClient,
  rows: SettingsRow[],
): Promise<{
  families: GrowthProviderSetupFamilySummary[]
  global: Awaited<ReturnType<typeof evaluateGlobalChecks>>
}> {
  const byFamily = new Map(rows.map((row) => [row.provider_family, row]))
  const families: GrowthProviderSetupFamilySummary[] = []

  for (const family of GROWTH_PROVIDER_SETUP_FAMILIES) {
    const row = byFamily.get(family) ?? null
    const readiness_checks = await evaluateFamilyChecks(admin, family, row)
    families.push({
      provider_family: family,
      label: providerSetupFamilyLabel(family),
      status: (asString(row?.status) || "not_configured") as GrowthProviderSetupFamilySummary["status"],
      oauth_account_email: row?.oauth_account_email ?? null,
      token_expires_at: row?.token_expires_at ?? null,
      last_refresh_at: row?.last_refresh_at ?? null,
      last_refresh_status: row?.last_refresh_status ?? null,
      sender_account_id: row?.sender_account_id ?? null,
      mailbox_connection_id: row?.mailbox_connection_id ?? null,
      delivery_provider_id: row?.delivery_provider_id ?? null,
      webhook_endpoint_id: row?.webhook_endpoint_id ?? null,
      credentials_configured: credentialsPresent(row?.encrypted_credentials ?? null),
      oauth_configured: oauthConfiguredForFamily(family),
      config_warnings: parseWarnings(row?.config_warnings),
      readiness_checks,
      cards: buildCards(family, row, readiness_checks),
    })
  }

  return { families, global: await evaluateGlobalChecks(admin) }
}

export async function persistProviderSetupReadinessSnapshot(
  admin: SupabaseClient,
  families: GrowthProviderSetupFamilySummary[],
  global: Awaited<ReturnType<typeof evaluateGlobalChecks>>,
): Promise<void> {
  const now = new Date().toISOString()
  const rows = [
    ...global.map((item) => ({
      provider_family: null,
      check_key: item.check_key,
      status: item.status,
      message: item.message,
      last_checked_at: now,
      metadata: {},
    })),
    ...families.flatMap((family) =>
      family.readiness_checks.map((check) => ({
        provider_family: family.provider_family,
        check_key: check.check_key,
        status: check.status,
        message: check.message,
        last_checked_at: now,
        metadata: {},
      })),
    ),
  ]

  for (const row of rows) {
    const query = admin.schema("growth").from("provider_setup_readiness").upsert(row, {
      onConflict: "provider_family,check_key",
    })
    await query
  }
}
