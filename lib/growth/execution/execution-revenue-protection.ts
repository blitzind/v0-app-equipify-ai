import type {
  ExecutionQueueItem,
  RevenueProtectionItem,
} from "@/lib/growth/execution/execution-priority-types"
import { computeExecutionPriorityScore } from "@/lib/growth/execution/execution-priority-score"

export type RevenueProtectionContext = {
  kind: RevenueProtectionItem["kind"]
  leadId: string | null
  companyName: string
  why: string
  ctaHref: string
  revenueAtRisk: number
  signals?: Partial<Record<RevenueProtectionItem["kind"], boolean>>
}

const PROTECTION_KINDS: RevenueProtectionItem["kind"][] = [
  "renewal_risk",
  "onboarding_stalled",
  "missing_follow_up",
  "open_objections",
  "stale_opportunity",
  "provider_failure",
  "calendar_conflict",
  "call_quality_decline",
  "meeting_follow_up_overdue",
  "unanswered_reply",
  "deal_risk_increase",
]

export function buildRevenueProtectionItem(ctx: RevenueProtectionContext): RevenueProtectionItem {
  const signalInput = { [ctx.kind]: true, ...(ctx.signals ?? {}) }
  const { executionPriorityScore, priorityBand } = computeExecutionPriorityScore(signalInput)
  return {
    id: `protect:${ctx.kind}:${ctx.leadId ?? "global"}`,
    kind: ctx.kind,
    label: ctx.kind.replace(/_/g, " "),
    leadId: ctx.leadId,
    companyName: ctx.companyName,
    priorityBand,
    executionPriorityScore,
    why: ctx.why,
    ctaHref: ctx.ctaHref,
    revenueAtRisk: ctx.revenueAtRisk,
  }
}

export function buildRevenueProtectionQueue(
  contexts: RevenueProtectionContext[],
): RevenueProtectionItem[] {
  return contexts
    .map(buildRevenueProtectionItem)
    .filter((item) => PROTECTION_KINDS.includes(item.kind))
    .sort((a, b) => b.executionPriorityScore - a.executionPriorityScore)
}

export function deriveRevenueProtectionFromQueue(items: ExecutionQueueItem[]): RevenueProtectionItem[] {
  const protectionCategories = new Set(["revenue_protection", "renewal", "follow_up_recovery", "meeting_completion"])
  return items
    .filter((item) => protectionCategories.has(item.category))
    .map((item) => {
      const kind = item.signals[0]?.key ?? "missing_follow_up"
      return buildRevenueProtectionItem({
        kind,
        leadId: item.leadId,
        companyName: item.companyName,
        why: item.why,
        ctaHref: item.ctaHref,
        revenueAtRisk: item.revenueInfluence,
        signals: Object.fromEntries(item.signals.map((s) => [s.key, true])) as RevenueProtectionContext["signals"],
      })
    })
}

export function sumRevenueProtected(items: RevenueProtectionItem[]): number {
  return items.reduce((sum, item) => sum + item.revenueAtRisk, 0)
}

export function countCriticalProtection(items: RevenueProtectionItem[]): number {
  return items.filter((item) => item.priorityBand === "critical" || item.priorityBand === "high").length
}
