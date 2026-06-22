/**
 * Growth workspace delivery / mailbox setup routes (GS-GROWTH-MAIL-7D).
 * Client-safe path constants — no server-only imports.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_DELIVERY_SETTINGS_QA_MARKER = "growth-delivery-settings-7d-v1" as const

/** Canonical operator-facing delivery + mailbox setup hub. */
export const GROWTH_DELIVERY_SETTINGS_PATH = `${GROWTH_WORKSPACE_BASE_PATH}/settings/delivery` as const

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_ANCHOR = "#connected-mailboxes" as const

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF =
  `${GROWTH_DELIVERY_SETTINGS_PATH}${GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_ANCHOR}` as const

/** Platform Admin control-plane provider setup (troubleshooting). */
export const GROWTH_ADMIN_PROVIDER_SETUP_PATH = "/admin/growth/providers/setup" as const

export const GROWTH_ADMIN_PROVIDERS_PATH = "/admin/growth/providers" as const

/** Lifted workspace settings paths for sender + DNS surfaces. */
export const GROWTH_WORKSPACE_SENDER_SETUP_PATH = "/settings/growth-engine/sending-domains" as const
export const GROWTH_WORKSPACE_SENDER_POOLS_PATH = "/settings/growth-engine/sender-pools" as const
export const GROWTH_WORKSPACE_DNS_VERIFICATION_PATH = "/settings/growth-engine/dns-verification" as const

export type GrowthProviderOAuthWorkspace = "growth" | "admin"

export function growthWorkspaceDeliverySetupHref(): string {
  return GROWTH_DELIVERY_SETTINGS_PATH
}

export function inferGrowthProviderOAuthWorkspace(returnTo: string | null | undefined): GrowthProviderOAuthWorkspace {
  const value = returnTo?.trim() ?? ""
  if (value.startsWith("/admin/growth/providers")) return "admin"
  if (value.startsWith(GROWTH_WORKSPACE_BASE_PATH)) return "growth"
  if (value.startsWith("/settings/growth-engine")) return "growth"
  return "growth"
}

export function defaultGrowthProviderOAuthReturnTo(
  workspace: GrowthProviderOAuthWorkspace = "growth",
): string {
  return workspace === "admin" ? GROWTH_ADMIN_PROVIDER_SETUP_PATH : GROWTH_DELIVERY_SETTINGS_PATH
}
