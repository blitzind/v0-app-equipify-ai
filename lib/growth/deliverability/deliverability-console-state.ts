/** Client-safe deliverability protection console state classification (8L). */

import {
  GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS,
  type GrowthDeliverabilityModuleResult,
  type GrowthDeliverabilityProtectionModuleId,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"
import { extractDomainFromEmail } from "@/lib/growth/sender/sender-domain-validator"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"

export const GROWTH_DELIVERABILITY_SETUP_IN_PROGRESS_QA_MARKER =
  "growth-deliverability-setup-in-progress-8l-v1" as const

export const DELIVERABILITY_SETUP_ONBOARDING_MESSAGE =
  "Setup in progress. Metrics will appear automatically after DNS configuration and outbound activity begin." as const

const ACTIVE_SENDER_STATUSES = new Set<GrowthSenderAccount["status"]>(["connected", "warning"])

export function activeSendingDomainNames(senders: GrowthSenderAccount[]): Set<string> {
  const names = new Set<string>()
  for (const sender of senders) {
    if (!ACTIVE_SENDER_STATUSES.has(sender.status)) continue
    const domain = extractDomainFromEmail(sender.email_address)
    if (domain) names.add(domain.toLowerCase())
  }
  return names
}

export function isActiveSendingDomain(domain: string, activeDomains: Set<string>): boolean {
  return activeDomains.has(domain.trim().toLowerCase())
}

/** True only for module fetch failures and unreachable diagnostics — not empty telemetry. */
export function isDeliverabilityConsoleDegraded(
  modules: Record<GrowthDeliverabilityProtectionModuleId, GrowthDeliverabilityModuleResult<unknown>> | undefined,
): boolean {
  if (!modules) return false
  return GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS.some((moduleId) => modules[moduleId]?.status === "error")
}

export function hasDeliverabilitySetupInProgress(
  modules: Record<GrowthDeliverabilityProtectionModuleId, GrowthDeliverabilityModuleResult<unknown>> | undefined,
): boolean {
  if (!modules) return false
  return GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS.some((moduleId) => modules[moduleId]?.status === "empty")
}

export function emptyModuleStatusLabel(moduleId: GrowthDeliverabilityProtectionModuleId): string {
  switch (moduleId) {
    case "sender_health":
      return "Not Started"
    case "dns_health":
      return "Setup In Progress"
    case "queue_ops":
    case "reputation_protection":
    case "sequence_safety":
      return "Awaiting Activity"
    default:
      return "Setup In Progress"
  }
}
