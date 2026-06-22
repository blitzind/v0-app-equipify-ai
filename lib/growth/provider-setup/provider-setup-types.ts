export const GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER = "growth-live-provider-setup-v1" as const

export const GROWTH_PROVIDER_SETUP_FAMILIES = [
  "google",
  "microsoft",
  "smtp",
  "ses",
  "resend",
  "custom",
] as const

export type GrowthProviderSetupFamily = (typeof GROWTH_PROVIDER_SETUP_FAMILIES)[number]

export const GROWTH_PROVIDER_CONNECTION_STATUSES = [
  "not_configured",
  "pending",
  "connected",
  "warning",
  "expired",
  "failed",
  "disabled",
] as const

export type GrowthProviderConnectionStatus = (typeof GROWTH_PROVIDER_CONNECTION_STATUSES)[number]

export const GROWTH_PROVIDER_READINESS_CHECK_KEYS = [
  "oauth_configured",
  "credentials_present",
  "sender_connected",
  "mailbox_connected",
  "dns_valid",
  "webhook_configured",
  "tracking_domain_ready",
  "compliance_ready",
  "governance_ready",
  "test_send_passed",
] as const

export type GrowthProviderReadinessCheckKey = (typeof GROWTH_PROVIDER_READINESS_CHECK_KEYS)[number]

export type GrowthProviderReadinessStatus = "pass" | "fail" | "warning" | "skipped"

export type GrowthProviderConnectionCheckType =
  | "test_connection"
  | "test_send"
  | "token_refresh"
  | "readiness"

export type GrowthProviderConnectionCheckResult = {
  check_type: GrowthProviderConnectionCheckType
  status: "passed" | "failed" | "warning" | "skipped"
  message: string
  details?: Record<string, unknown>
}

export type GrowthProviderSetupCardKey =
  | "oauth_status"
  | "credential_status"
  | "mailbox_sync_status"
  | "transport_status"
  | "webhook_status"
  | "tracking_status"
  | "compliance_status"
  | "governance_status"

export type GrowthProviderSetupCard = {
  key: GrowthProviderSetupCardKey
  label: string
  status: GrowthProviderReadinessStatus
  message: string
}

export type GrowthProviderSetupFamilySummary = {
  provider_family: GrowthProviderSetupFamily
  label: string
  status: GrowthProviderConnectionStatus
  oauth_account_email: string | null
  token_expires_at: string | null
  last_refresh_at: string | null
  last_refresh_status: string | null
  sender_account_id: string | null
  mailbox_connection_id: string | null
  delivery_provider_id: string | null
  webhook_endpoint_id: string | null
  credentials_configured: boolean
  oauth_configured: boolean
  config_warnings: string[]
  cards: GrowthProviderSetupCard[]
  readiness_checks: Array<{
    check_key: GrowthProviderReadinessCheckKey
    status: GrowthProviderReadinessStatus
    message: string
  }>
}

export type GrowthProviderSetupDashboard = {
  qa_marker: typeof GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER
  env_warnings: string[]
  tracking_base_url: string | null
  families: GrowthProviderSetupFamilySummary[]
  global_readiness: Array<{
    check_key: GrowthProviderReadinessCheckKey
    status: GrowthProviderReadinessStatus
    message: string
  }>
  webhook_url_template: string
}

export type GrowthProviderSetupReadinessResult = {
  qa_marker: typeof GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER
  families: GrowthProviderSetupFamilySummary["readiness_checks"]
  global: GrowthProviderSetupDashboard["global_readiness"]
}

export type GrowthProviderCredentialInput = Record<string, unknown>

export const GROWTH_PROVIDER_SETUP_OAUTH_FAMILIES = ["google", "microsoft"] as const

export type GrowthProviderSetupOAuthFamily = (typeof GROWTH_PROVIDER_SETUP_OAUTH_FAMILIES)[number]

export const GROWTH_PROVIDER_SETUP_CREDENTIAL_FAMILIES = ["smtp", "ses", "resend", "custom"] as const

export function isGrowthProviderSetupFamily(value: string): value is GrowthProviderSetupFamily {
  return GROWTH_PROVIDER_SETUP_FAMILIES.includes(value as GrowthProviderSetupFamily)
}

export function providerSetupFamilyLabel(family: GrowthProviderSetupFamily): string {
  switch (family) {
    case "google":
      return "Google Workspace"
    case "microsoft":
      return "Microsoft 365"
    case "smtp":
      return "SMTP"
    case "ses":
      return "Amazon SES"
    case "resend":
      return "Resend"
    default:
      return "Custom"
  }
}

export const GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES = [
  "/growth/settings/delivery",
  "/admin/growth/providers/setup",
  "/admin/growth/infrastructure/mailboxes",
  "/admin/growth/providers/delivery",
  "/growth/settings/connected-mailboxes",
  "/growth/settings",
  "/growth",
  "/settings/growth-engine",
] as const

export const GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES = [
  "encrypted_credentials",
  "access_token",
  "refresh_token",
  "api_key",
  "api_secret",
  "password",
  "signing_secret",
  "signing_secret_hash",
  "client_secret",
] as const
