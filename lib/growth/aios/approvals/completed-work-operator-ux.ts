/**
 * GE-AIOS-OPERATOR-UX-1A — Completed Work prioritization & lifecycle helpers (client-safe).
 *
 * Projection helpers only — mutations reuse existing lead/package/Draft Factory APIs.
 */

import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAvaCompletedWorkCategoryId } from "@/lib/growth/aios/approvals/ava-completed-work-contract"
import { categorizeAvaCompletedWorkItem } from "@/lib/growth/aios/approvals/ava-completed-work-projection"

export const GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER =
  "ge-aios-operator-ux-1a-completed-work-lifecycle-controls-v1" as const

/** Lead statuses that must not appear as actionable Completed Work. */
export const COMPLETED_WORK_INACTIVE_LEAD_STATUSES = [
  "archived",
  "disqualified",
] as const

export type CompletedWorkLeadLifecycleSnapshot = {
  leadId: string
  status: string | null
  archivedAt: string | null
  companyName?: string | null
}

export type CompletedWorkOperatorBucket =
  | "ready_outreach"
  | "ready_needs_revision"
  | "ready_meeting"
  | "ready_follow_up"
  | "ready_other"
  | "supporting_calibration"
  | "supporting_risk"
  | "supporting_objective"
  | "history"

export type CompletedWorkOperatorActionId =
  | "review_outreach"
  | "review_follow_up"
  | "review_recommendation"
  | "view_risk_details"
  | "open_account"
  | "dismiss"
  | "cancel_work"
  | "archive_account"
  | "restore_account"
  | "delete_permanently"
  | "authorize"
  | "needs_revision"
  | "reject"

export function isInactiveLeadLifecycle(input: {
  status?: string | null
  archivedAt?: string | null
}): boolean {
  if (input.archivedAt) return true
  const status = input.status?.trim().toLowerCase() ?? ""
  return (COMPLETED_WORK_INACTIVE_LEAD_STATUSES as readonly string[]).includes(status)
}

export function isCanceledPackageDecision(decision?: string | null): boolean {
  return decision === "rejected" || decision === "approved"
}

/**
 * Active Completed Work excludes archived/disqualified subjects and
 * already-decided outreach packages (caller may also pass dismissed ids).
 */
export function filterActiveCompletedWorkItems(input: {
  items: GrowthHumanApprovalItem[]
  leadLifecycleById?: Map<string, CompletedWorkLeadLifecycleSnapshot>
  dismissedItemIds?: ReadonlySet<string>
}): GrowthHumanApprovalItem[] {
  const lifecycle = input.leadLifecycleById ?? new Map()
  const dismissed = input.dismissedItemIds ?? new Set<string>()

  return input.items.filter((item) => {
    if (dismissed.has(item.id)) return false
    if (item.status === "approved" || item.status === "rejected" || item.status === "approved_elsewhere") {
      // Keep approved_elsewhere for outbound scope activation; drop decided outreach.
      if (item.source === "outreach_package" && item.status !== "approved_elsewhere") return false
    }
    const leadId = item.subjectType === "lead" ? item.subjectId : null
    if (!leadId) return true
    const snap = lifecycle.get(leadId)
    if (!snap) return true
    return !isInactiveLeadLifecycle(snap)
  })
}

export function resolveCompletedWorkOperatorBucket(
  item: GrowthHumanApprovalItem,
): CompletedWorkOperatorBucket {
  const category = categorizeAvaCompletedWorkItem(item)
  if (category === "outreach_packages") return "ready_outreach"
  if (category === "meeting_preparations") return "ready_meeting"
  if (item.actionType === "review_blocker" || item.riskLevel === "high") {
    if (item.source === "adaptive_calibration" || item.source === "meta_recommender") {
      return "supporting_calibration"
    }
    return "supporting_risk"
  }
  if (item.source === "adaptive_calibration" || item.source === "meta_recommender") {
    return "supporting_calibration"
  }
  if (item.source === "priority_binding" || item.source === "revenue_operator") {
    return "supporting_objective"
  }
  if (category === "follow_up_recommendations") {
    return "ready_follow_up"
  }
  if (category === "accounts_need_review") return "ready_other"
  return "ready_other"
}

export function isSupportingCompletedWorkBucket(bucket: CompletedWorkOperatorBucket): boolean {
  return (
    bucket === "supporting_calibration" ||
    bucket === "supporting_risk" ||
    bucket === "supporting_objective" ||
    bucket === "history"
  )
}

export type CompletedWorkActionableSummary = {
  outreachPackages: number
  followUpDecisions: number
  supportingRecommendations: number
  totalActionable: number
}

export function summarizeActionableCompletedWork(
  items: GrowthHumanApprovalItem[],
): CompletedWorkActionableSummary {
  let outreachPackages = 0
  let followUpDecisions = 0
  let supportingRecommendations = 0

  for (const item of items) {
    const bucket = resolveCompletedWorkOperatorBucket(item)
    if (bucket === "ready_outreach") outreachPackages += 1
    else if (
      bucket === "ready_follow_up" ||
      bucket === "ready_needs_revision" ||
      bucket === "ready_meeting"
    ) {
      followUpDecisions += 1
    } else supportingRecommendations += 1
  }

  return {
    outreachPackages,
    followUpDecisions,
    supportingRecommendations,
    totalActionable: items.length,
  }
}

/** Sort: outreach first, then follow-up, then other ready, supporting last. */
export function sortCompletedWorkForOperatorPriority<T extends { item: GrowthHumanApprovalItem }>(
  rows: T[],
): T[] {
  const rank: Record<CompletedWorkOperatorBucket, number> = {
    ready_outreach: 0,
    ready_needs_revision: 1,
    ready_meeting: 2,
    ready_follow_up: 3,
    ready_other: 4,
    supporting_risk: 5,
    supporting_objective: 6,
    supporting_calibration: 7,
    history: 8,
  }
  return [...rows].sort((a, b) => {
    const ba = resolveCompletedWorkOperatorBucket(a.item)
    const bb = resolveCompletedWorkOperatorBucket(b.item)
    const diff = rank[ba] - rank[bb]
    if (diff !== 0) return diff
    return b.item.priorityScore - a.item.priorityScore
  })
}

export function resolveCompletedWorkContextualCta(item: GrowthHumanApprovalItem): string {
  const bucket = resolveCompletedWorkOperatorBucket(item)
  if (bucket === "ready_outreach") return "Review Outreach"
  if (bucket === "ready_meeting") return "Review Meeting Prep"
  if (bucket === "ready_follow_up") return "Review Follow-Up"
  if (bucket === "supporting_risk") return "View Risk Details"
  if (bucket === "supporting_calibration" || bucket === "supporting_objective") {
    return "Review Recommendation"
  }
  if (item.subjectType === "lead" && item.subjectId) return "Open Account"
  return "Review Recommendation"
}

export function resolveCompletedWorkOverflowActions(input: {
  item: GrowthHumanApprovalItem
  leadLifecycle?: CompletedWorkLeadLifecycleSnapshot | null
}): CompletedWorkOperatorActionId[] {
  const inactive = input.leadLifecycle
    ? isInactiveLeadLifecycle(input.leadLifecycle)
    : false
  const bucket = resolveCompletedWorkOperatorBucket(input.item)
  const actions: CompletedWorkOperatorActionId[] = []

  if (inactive) {
    actions.push("open_account", "restore_account", "delete_permanently")
    return actions
  }

  if (bucket === "ready_outreach") {
    actions.push(
      "review_outreach",
      "authorize",
      "needs_revision",
      "reject",
      "cancel_work",
      "archive_account",
      "open_account",
    )
    return actions
  }

  if (bucket === "supporting_calibration" || bucket === "supporting_objective") {
    actions.push("review_recommendation", "dismiss", "open_account")
    return actions
  }

  if (bucket === "supporting_risk") {
    actions.push("view_risk_details", "dismiss", "archive_account", "open_account")
    return actions
  }

  actions.push("review_recommendation", "dismiss", "cancel_work", "archive_account", "open_account")
  return actions
}

export function canAuthorizeCompletedWorkItem(input: {
  item: GrowthHumanApprovalItem
  leadLifecycle?: CompletedWorkLeadLifecycleSnapshot | null
}): boolean {
  if (input.leadLifecycle && isInactiveLeadLifecycle(input.leadLifecycle)) return false
  if (input.item.source !== "outreach_package") return false
  if (input.item.status === "rejected" || input.item.status === "approved") return false
  return true
}

export const COMPLETED_WORK_DISMISS_STORAGE_PREFIX = "equipify:growth:completed-work-dismissed/v1" as const

export function completedWorkDismissStorageKey(organizationId: string): string {
  return `${COMPLETED_WORK_DISMISS_STORAGE_PREFIX}:${organizationId}`
}

export function readDismissedCompletedWorkItemIds(organizationId: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(completedWorkDismissStorageKey(organizationId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return new Set()
  }
}

export function persistDismissedCompletedWorkItemId(
  organizationId: string,
  itemId: string,
): Set<string> {
  const next = readDismissedCompletedWorkItemIds(organizationId)
  next.add(itemId)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        completedWorkDismissStorageKey(organizationId),
        JSON.stringify([...next]),
      )
    } catch {
      // ignore quota
    }
  }
  return next
}

export function groupSupportingCompletedWork(
  items: GrowthHumanApprovalItem[],
): Array<{ bucket: CompletedWorkOperatorBucket; label: string; count: number; items: GrowthHumanApprovalItem[] }> {
  const groups: Record<string, GrowthHumanApprovalItem[]> = {
    supporting_calibration: [],
    supporting_risk: [],
    supporting_objective: [],
  }
  for (const item of items) {
    const bucket = resolveCompletedWorkOperatorBucket(item)
    if (bucket in groups) groups[bucket]!.push(item)
  }
  return [
    {
      bucket: "supporting_calibration" as const,
      label: "calibration recommendations",
      count: groups.supporting_calibration!.length,
      items: groups.supporting_calibration!,
    },
    {
      bucket: "supporting_risk" as const,
      label: "risk notices",
      count: groups.supporting_risk!.length,
      items: groups.supporting_risk!,
    },
    {
      bucket: "supporting_objective" as const,
      label: "objective updates",
      count: groups.supporting_objective!.length,
      items: groups.supporting_objective!,
    },
  ].filter((row) => row.count > 0)
}

export function categoryToOperatorSection(
  category: GrowthAvaCompletedWorkCategoryId,
): "primary" | "supporting" {
  if (category === "outreach_packages" || category === "meeting_preparations" || category === "follow_up_recommendations") {
    return "primary"
  }
  return "supporting"
}
