/** Provider family capability registry for sender infrastructure. Client-safe. */

import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

export type GrowthSenderProviderCapabilities = {
  provider_family: GrowthSenderProviderFamily
  label: string
  supportsOauth: boolean
  supportsWarmup: boolean
  supportsReplySync: boolean
  supportsHealthMonitoring: boolean
  supportsRotation: boolean
  supportsMailboxConnection: boolean
  supportsTokenRefresh: boolean
  supportsValidation: boolean
}

export const GROWTH_SENDER_PROVIDER_CAPABILITIES: Record<
  GrowthSenderProviderFamily,
  GrowthSenderProviderCapabilities
> = {
  google: {
    provider_family: "google",
    label: "Google Workspace",
    supportsOauth: true,
    supportsWarmup: true,
    supportsReplySync: true,
    supportsHealthMonitoring: true,
    supportsRotation: true,
    supportsMailboxConnection: true,
    supportsTokenRefresh: true,
    supportsValidation: true,
  },
  microsoft: {
    provider_family: "microsoft",
    label: "Microsoft 365",
    supportsOauth: true,
    supportsWarmup: true,
    supportsReplySync: true,
    supportsHealthMonitoring: true,
    supportsRotation: true,
    supportsMailboxConnection: true,
    supportsTokenRefresh: true,
    supportsValidation: true,
  },
  smtp: {
    provider_family: "smtp",
    label: "SMTP",
    supportsOauth: false,
    supportsWarmup: false,
    supportsReplySync: false,
    supportsHealthMonitoring: true,
    supportsRotation: true,
    supportsMailboxConnection: true,
    supportsTokenRefresh: false,
    supportsValidation: true,
  },
  custom: {
    provider_family: "custom",
    label: "Custom",
    supportsOauth: false,
    supportsWarmup: false,
    supportsReplySync: false,
    supportsHealthMonitoring: true,
    supportsRotation: false,
    supportsMailboxConnection: true,
    supportsTokenRefresh: false,
    supportsValidation: true,
  },
}

export function getSenderProviderCapabilities(
  providerFamily: GrowthSenderProviderFamily,
): GrowthSenderProviderCapabilities {
  return GROWTH_SENDER_PROVIDER_CAPABILITIES[providerFamily]
}

export function listSenderProviderCapabilities(): GrowthSenderProviderCapabilities[] {
  return Object.values(GROWTH_SENDER_PROVIDER_CAPABILITIES)
}
