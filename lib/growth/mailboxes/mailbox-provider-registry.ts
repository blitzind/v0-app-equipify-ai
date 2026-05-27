/** Mailbox provider capability registry. Client-safe. */

import type { GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

export type GrowthMailboxProviderCapabilities = {
  provider_family: GrowthSenderProviderFamily
  label: string
  oauth: boolean
  refreshable: boolean
  smtp: boolean
  replySync: boolean
}

export const GROWTH_MAILBOX_PROVIDER_CAPABILITIES: Record<
  GrowthSenderProviderFamily,
  GrowthMailboxProviderCapabilities
> = {
  google: {
    provider_family: "google",
    label: "Google Workspace",
    oauth: true,
    refreshable: true,
    smtp: false,
    replySync: true,
  },
  microsoft: {
    provider_family: "microsoft",
    label: "Microsoft 365",
    oauth: true,
    refreshable: true,
    smtp: false,
    replySync: true,
  },
  smtp: {
    provider_family: "smtp",
    label: "SMTP",
    oauth: false,
    refreshable: false,
    smtp: true,
    replySync: false,
  },
  custom: {
    provider_family: "custom",
    label: "Custom",
    oauth: false,
    refreshable: false,
    smtp: true,
    replySync: false,
  },
}

export function getMailboxProviderCapabilities(
  providerFamily: GrowthSenderProviderFamily,
): GrowthMailboxProviderCapabilities {
  return GROWTH_MAILBOX_PROVIDER_CAPABILITIES[providerFamily]
}

export function listMailboxProviderCapabilities(): GrowthMailboxProviderCapabilities[] {
  return Object.values(GROWTH_MAILBOX_PROVIDER_CAPABILITIES)
}
