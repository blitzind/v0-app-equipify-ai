/**
 * Server-safe provider setup constants — no React, no "use client", no browser APIs.
 * Import from here in lib/, app/api/, and scripts/ instead of client components.
 */

export {
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
  GROWTH_PROVIDER_CONNECTION_STATUSES,
  GROWTH_PROVIDER_READINESS_CHECK_KEYS,
  GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES,
  GROWTH_PROVIDER_SETUP_CREDENTIAL_FAMILIES,
  GROWTH_PROVIDER_SETUP_FAMILIES,
  GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES,
  GROWTH_PROVIDER_SETUP_OAUTH_FAMILIES,
  isGrowthProviderSetupFamily,
  providerSetupFamilyLabel,
} from "@/lib/growth/provider-setup/provider-setup-types"

export {
  GROWTH_ADMIN_PROVIDER_SETUP_PATH,
  GROWTH_ADMIN_PROVIDERS_PATH,
  GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF,
  GROWTH_DELIVERY_SETTINGS_PATH,
  GROWTH_DELIVERY_SETTINGS_QA_MARKER,
  GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
  GROWTH_WORKSPACE_SENDER_POOLS_PATH,
  GROWTH_WORKSPACE_SENDER_SETUP_PATH,
  defaultGrowthProviderOAuthReturnTo,
  growthWorkspaceDeliverySetupHref,
  inferGrowthProviderOAuthWorkspace,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"

export type { GrowthProviderOAuthWorkspace } from "@/lib/growth/navigation/growth-delivery-settings-navigation"

/** data-qa selector on sender account Select overlay (provider setup dashboard). */
export const GROWTH_PROVIDER_SETUP_SENDER_SELECT_QA = "growth-sender-select-overlay-fix-v1" as const
