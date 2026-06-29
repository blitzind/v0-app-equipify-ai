/**
 * Growth workspace delivery / mailbox setup routes (GS-GROWTH-MAIL-7D, GS-GROWTH-SETTINGS-8K).
 * Client-safe path constants — customer canonical paths use Growth workspace settings.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_DELIVERY_SETTINGS_QA_MARKER = "growth-delivery-settings-8k-v1" as const

/** Compatibility hub in Growth workspace shell. */
export const GROWTH_DELIVERY_SETTINGS_PATH = GROWTH_COMMUNICATIONS_SETTINGS_PATH

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_ANCHOR = GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF = GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF

/** Platform Admin control-plane provider setup (troubleshooting). */
export const GROWTH_ADMIN_PROVIDER_SETUP_PATH = "/admin/growth/providers/setup" as const

export const GROWTH_ADMIN_PROVIDERS_PATH = "/admin/growth/providers" as const

/** Customer canonical paths — Workspace Settings growth-engine sections. */
export const GROWTH_WORKSPACE_SENDER_SETUP_PATH = growthEngineCustomerSettingsHref("sending-domains")
export const GROWTH_WORKSPACE_SENDER_POOLS_PATH = growthEngineCustomerSettingsHref("sender-pools")
export const GROWTH_WORKSPACE_DNS_VERIFICATION_PATH = growthEngineCustomerSettingsHref("dns-verification")
export const GROWTH_WORKSPACE_MAILBOXES_PATH = growthEngineCustomerSettingsHref("connected-mailboxes")
export const GROWTH_WORKSPACE_WARMUP_PATH = growthEngineCustomerSettingsHref("warmup")
export const GROWTH_WORKSPACE_REPUTATION_PATH = growthEngineCustomerSettingsHref("sending-limits")

export type GrowthProviderOAuthWorkspace = "growth" | "admin"

export function growthWorkspaceDeliverySetupHref(): string {
  return growthEngineCustomerSettingsHref("connected-mailboxes")
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
  return workspace === "admin" ? GROWTH_ADMIN_PROVIDER_SETUP_PATH : GROWTH_WORKSPACE_MAILBOXES_PATH
}
