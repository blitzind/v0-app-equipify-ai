/** GE-AIOS-11A — Daily work plan builder with blocking and interrupt handling. */

import {
  applyWorkItemStatus,
  isExecutableWorkItem,
  isOperatorWorkItem,
  resolveWorkItemStatus,
} from "@/lib/growth/work-manager/state/work-item-state"
import { detectWorkInterruptions, prioritizeWorkItems } from "@/lib/growth/work-manager/scheduler/prioritize-work-items"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  AvaWorkInterruption,
  AvaWorkItem,
  AvaWorkManagerResult,
  AvaWorkPlanEntry,
} from "@/lib/growth/work-manager/types"
import type { GrowthHomeAccomplishmentGroup } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildCompletedWorkItems(
  accomplishments: GrowthHomeAccomplishmentGroup[],
  researchLoopSummary: GrowthAvaResearchLoopSummary | null,
  timestamp: string,
): AvaWorkItem[] {
  const items: AvaWorkItem[] = []

  if (researchLoopSummary) {
    if (researchLoopSummary.researchCompleted > 0) {
      items.push({
        id: "completed:researched",
        type: "research",
        title: `Researched ${researchLoopSummary.researchCompleted} ${pluralize(researchLoopSummary.researchCompleted, "company", "companies")}`,
        description: null,
        status: "completed",
        priority: 0,
        source: "accomplishment",
        created_at: timestamp,
        updated_at: timestamp,
        estimated_minutes: null,
        estimated_revenue_impact: null,
        requires_operator: false,
        can_execute_autonomously: false,
        depends_on: [],
        blocked_by: [],
        next_action: null,
        decision_score: 0,
        confidence: 0,
        href: null,
        company_name: null,
        decision_source_id: "completed:researched",
      })
    }
    if (researchLoopSummary.qualificationCompleted > 0) {
      items.push({
        id: "completed:qualified",
        type: "qualification",
        title: `Qualified ${researchLoopSummary.qualificationCompleted} companies`,
        description: null,
        status: "completed",
        priority: 0,
        source: "accomplishment",
        created_at: timestamp,
        updated_at: timestamp,
        estimated_minutes: null,
        estimated_revenue_impact: null,
        requires_operator: false,
        can_execute_autonomously: false,
        depends_on: [],
        blocked_by: [],
        next_action: null,
        decision_score: 0,
        confidence: 0,
        href: null,
        company_name: null,
        decision_source_id: "completed:qualified",
      })
    }
  }

  for (const group of accomplishments) {
    for (const line of group.items.slice(0, 3)) {
      items.push({
        id: `completed:${group.id}:${line.slice(0, 24)}`,
        type: "mission",
        title: line,
        description: null,
        status: "completed",
        priority: 0,
        source: "accomplishment",
        created_at: timestamp,
        updated_at: timestamp,
        estimated_minutes: null,
        estimated_revenue_impact: null,
        requires_operator: false,
        can_execute_autonomously: false,
        depends_on: [],
        blocked_by: [],
        next_action: null,
        decision_score: 0,
        confidence: 0,
        href: null,
        company_name: null,
        decision_source_id: `completed:${group.id}`,
      })
    }
  }

  return items.slice(0, 6)
}

export function buildDailyWorkPlan(input: {
  workItems: AvaWorkItem[]
  completedToday: AvaWorkItem[]
  leadsById?: ReadonlyMap<string, GrowthLead>
  generatedAt?: string
  organizationId?: string | null
}): Pick<
  AvaWorkManagerResult,
  "active_work" | "work_plan" | "blocked" | "deferred" | "interruptions" | "operator_queue" | "all_work_items"
> {
  const sorted = prioritizeWorkItems(input.workItems.filter((item) => item.type !== "wait"), {
    leadsById: input.leadsById,
    generatedAt: input.generatedAt,
    organizationId: input.organizationId,
  })
  const operatorQueue = sorted
    .filter((item) => isOperatorWorkItem(item))
    .map((item) => applyWorkItemStatus(item, resolveWorkItemStatus(item, { forceOperatorWait: true })))

  const blocked = sorted
    .filter((item) => item.blocked_by.length > 0 && !isOperatorWorkItem(item))
    .map((item) => applyWorkItemStatus(item, "blocked"))

  const executableCandidates = sorted.filter(
    (item) => !isOperatorWorkItem(item) && item.blocked_by.length === 0 && item.type !== "wait",
  )

  const provisionalActive = executableCandidates.find((item) => isExecutableWorkItem(item)) ?? executableCandidates[0] ?? null

  const interruptionCandidates = detectWorkInterruptions(sorted, provisionalActive ?? null)
  const interruptions: AvaWorkInterruption[] = interruptionCandidates.map((row, index) => ({
    id: `interrupt:${index}:${row.reply.id}`,
    inserted_work_item_id: row.reply.id,
    paused_work_item_id: row.paused?.id ?? null,
    reason_code: "customer_reply",
    reason_label: "Customer reply received",
  }))

  let activeWork: AvaWorkItem | null = null
  if (interruptionCandidates.length > 0 && interruptionCandidates[0]?.reply) {
    activeWork = applyWorkItemStatus(interruptionCandidates[0].reply, "working")
  } else if (provisionalActive) {
    activeWork = applyWorkItemStatus(provisionalActive, resolveWorkItemStatus(provisionalActive, { isActive: true }))
  }

  const planItems: AvaWorkItem[] = []
  const seen = new Set<string>()

  if (activeWork) {
    planItems.push(activeWork)
    seen.add(activeWork.id)
  }

  for (const interruption of interruptions) {
    const replyItem = sorted.find((row) => row.id === interruption.inserted_work_item_id)
    if (replyItem && !seen.has(replyItem.id) && replyItem.id !== activeWork?.id) {
      planItems.push(applyWorkItemStatus(replyItem, "ready"))
      seen.add(replyItem.id)
    }
  }

  for (const item of sorted) {
    if (seen.has(item.id)) continue
    if (item.type === "wait") continue

    if (isOperatorWorkItem(item)) {
      planItems.push(applyWorkItemStatus(item, "waiting_for_operator"))
      seen.add(item.id)
      continue
    }

    if (item.blocked_by.length > 0) {
      continue
    }

    planItems.push(applyWorkItemStatus(item, item.id === activeWork?.id ? "working" : "ready"))
    seen.add(item.id)
    if (planItems.length >= 8) break
  }

  const deferred = sorted
    .filter((item) => !seen.has(item.id) && item.type !== "wait")
    .map((item) => applyWorkItemStatus(item, "deferred"))

  const work_plan: AvaWorkPlanEntry[] = planItems.slice(0, 8).map((item, index) => ({
    position: index + 1,
    work_item_id: item.id,
    title: item.title,
    status: item.status,
  }))

  const all_work_items = [
    ...planItems,
    ...blocked,
    ...operatorQueue.filter((item) => !planItems.some((row) => row.id === item.id)),
    ...deferred,
    ...input.completedToday,
  ]

  return {
    active_work: activeWork,
    work_plan,
    blocked,
    deferred,
    interruptions,
    operator_queue: operatorQueue,
    all_work_items,
  }
}
