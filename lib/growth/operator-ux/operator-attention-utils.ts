/** Client-safe operator attention visibility — suppress passive healthy-state banners. */

import type { GrowthInfrastructureReadinessDescriptor } from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import type {
  GrowthOperatorAttentionItem,
  GrowthOperatorAttentionStrip,
} from "@/lib/growth/operator-ux/operator-ux-h3-types"

export const GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER = "growth-attention-quiet-healthy-v1" as const
export const GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER = "growth-attention-actionable-only-v1" as const

export function isActionableOperatorAttentionItem(item: GrowthOperatorAttentionItem): boolean {
  return item.count > 0
}

export function hasActionableOperatorAttention(
  strip: Pick<GrowthOperatorAttentionStrip, "items"> | null | undefined,
): boolean {
  return (strip?.items ?? []).some(isActionableOperatorAttentionItem)
}

export function hasActionableCommunicationOpsMetrics(input: {
  criticalCount?: number
  needsApprovalCount?: number
  myWorkCount?: number
  highPriorityReplies?: number
  callTasksDue?: number
  meetingsToday?: number
  cadenceDue?: number
  overdueCadence?: number
  providerIssues?: number
  liveCoachingActive?: boolean
}): boolean {
  const needsAttention =
    (input.criticalCount ?? 0) + (input.needsApprovalCount ?? 0) + (input.myWorkCount ?? 0)
  return (
    needsAttention > 0 ||
    (input.highPriorityReplies ?? 0) > 0 ||
    (input.callTasksDue ?? 0) > 0 ||
    (input.meetingsToday ?? 0) > 0 ||
    (input.cadenceDue ?? 0) > 0 ||
    (input.overdueCadence ?? 0) > 0 ||
    (input.providerIssues ?? 0) > 0 ||
    Boolean(input.liveCoachingActive)
  )
}

export function hasActionableGrowthSidebarHealth(input: {
  openInbox?: number
  pendingApproval?: number
  criticalSignals?: number
  systemHealthLabel?: string
  degraded?: boolean
}): boolean {
  if (input.degraded) return true
  if ((input.criticalSignals ?? 0) > 0) return true
  if ((input.pendingApproval ?? 0) > 0) return true
  if ((input.openInbox ?? 0) > 0) return true
  const label = input.systemHealthLabel ?? "Healthy"
  return label !== "Healthy"
}

export function isActionableInfrastructureReadiness(
  status: GrowthInfrastructureReadinessDescriptor["status"],
): boolean {
  return status !== "live"
}

export function hasActionableDnsSetupStatus(summary: {
  workingToday: string[]
  notConnectedYet: string[]
  nextSteps: string[]
}): boolean {
  return (
    summary.notConnectedYet.length > 0 ||
    summary.nextSteps.length > 0 ||
    summary.workingToday.length === 0
  )
}

export function shouldRenderOperatorAttentionSection<T>(
  items: T[] | null | undefined,
  predicate?: (item: T) => boolean,
): boolean {
  const rows = items ?? []
  if (rows.length === 0) return false
  if (!predicate) return true
  return rows.some(predicate)
}
