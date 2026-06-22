/**
 * Growth workspace delivery / mailbox setup routes (GS-GROWTH-MAIL-7D, GS-GROWTH-SETTINGS-8C).
 * Client-safe path constants — no server-only imports.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR,
  GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF,
  GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_REPUTATION_PATH,
  GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH,
  GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
  GROWTH_COMMUNICATIONS_WARMUP_PATH,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"

export const GROWTH_DELIVERY_SETTINGS_QA_MARKER = "growth-delivery-settings-8c-v1" as const

/** Canonical operator-facing communications settings hub. */
export const GROWTH_DELIVERY_SETTINGS_PATH = GROWTH_COMMUNICATIONS_SETTINGS_PATH

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_ANCHOR = GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_ANCHOR

export const GROWTH_DELIVERY_SETTINGS_CONNECTED_MAILBOXES_HREF = GROWTH_COMMUNICATIONS_CONNECTED_MAILBOXES_HREF

/** Platform Admin control-plane provider setup (troubleshooting). */
export const GROWTH_ADMIN_PROVIDER_SETUP_PATH = "/admin/growth/providers/setup" as const

export const GROWTH_ADMIN_PROVIDERS_PATH = "/admin/growth/providers" as const

/** Workspace communications paths for sender + DNS surfaces. */
export const GROWTH_WORKSPACE_SENDER_SETUP_PATH = GROWTH_COMMUNICATIONS_SENDING_DOMAINS_PATH
export const GROWTH_WORKSPACE_SENDER_POOLS_PATH = GROWTH_COMMUNICATIONS_SENDER_POOLS_PATH
export const GROWTH_WORKSPACE_DNS_VERIFICATION_PATH = GROWTH_COMMUNICATIONS_DELIVERABILITY_PATH
export const GROWTH_WORKSPACE_MAILBOXES_PATH = GROWTH_COMMUNICATIONS_MAILBOXES_PATH
export const GROWTH_WORKSPACE_WARMUP_PATH = GROWTH_COMMUNICATIONS_WARMUP_PATH
export const GROWTH_WORKSPACE_REPUTATION_PATH = GROWTH_COMMUNICATIONS_REPUTATION_PATH

export type GrowthProviderOAuthWorkspace = "growth" | "admin"

export function growthWorkspaceDeliverySetupHref(): string {
  return GROWTH_COMMUNICATIONS_SETTINGS_PATH
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
  return workspace === "admin" ? GROWTH_ADMIN_PROVIDER_SETUP_PATH : GROWTH_COMMUNICATIONS_MAILBOXES_PATH
}
