/** GE-AIOS-11A — Bridge Work Manager output into Narrative Engine (no direct decision reads). */

import type { AvaPrioritizedStory, AvaStoryBlock, AvaStoryKind } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaWorkItem, AvaWorkManagerResult, AvaWorkItemType } from "@/lib/growth/work-manager/types"

const WORK_TYPE_TO_STORY_KIND: Record<AvaWorkItemType, AvaStoryKind> = {
  approval: "approval",
  reply: "reply",
  meeting: "meeting",
  outreach: "opportunity",
  qualification: "discovery",
  research: "research",
  mission: "mission",
  business_understanding: "risk",
  wait: "general",
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function mapWorkItemTypeToStoryKind(type: AvaWorkItemType): AvaStoryKind {
  return WORK_TYPE_TO_STORY_KIND[type] ?? "general"
}

export function mapWorkPlanToStoryPriority(result: AvaWorkManagerResult): AvaPrioritizedStory[] {
  return result.work_plan
    .filter((entry) => entry.status !== "deferred" && entry.status !== "completed")
    .map((entry) => {
      const item = result.all_work_items.find((row) => row.id === entry.work_item_id)
      return {
        kind: mapWorkItemTypeToStoryKind(item?.type ?? "mission"),
        priority: item?.decision_score ?? 0,
        factId: item?.decision_source_id ?? entry.work_item_id,
      }
    })
}

export function buildTodayPrioritiesFromWorkPlan(result: AvaWorkManagerResult): string[] {
  return result.work_plan
    .filter((entry) => entry.status !== "waiting_for_operator" && entry.status !== "completed")
    .slice(0, 5)
    .map((entry) => entry.title.replace(/\.$/, ""))
}

export function buildWorkManagerStoryBlocks(result: AvaWorkManagerResult): AvaStoryBlock[] {
  const lines = buildWorkManagerNarrativeLines(result)
  return lines.map((text, index) => {
    const planEntry = result.work_plan[index]
    const item = planEntry
      ? result.all_work_items.find((row) => row.id === planEntry.work_item_id)
      : null
    return {
      id: `work-narrative:${index}`,
      kind: mapWorkItemTypeToStoryKind(item?.type ?? "mission"),
      priority: item?.decision_score ?? 100 - index,
      text,
      href: item?.href ?? null,
    }
  })
}

export function buildWorkManagerNarrativeLines(result: AvaWorkManagerResult): string[] {
  const lines: string[] = []
  const operatorCount = result.operator_queue.length
  const approvalCount = result.operator_queue.filter((item) => item.type === "approval").length

  if (approvalCount > 0) {
    lines.push(
      `I'm currently waiting for approval on ${approvalCount} outreach ${pluralize(approvalCount, "draft", "drafts")}.`,
    )
  } else if (operatorCount > 0) {
    lines.push(
      `I'm waiting on ${operatorCount} ${pluralize(operatorCount, "decision", "decisions")} from you before I continue.`,
    )
  }

  if (result.interruptions.length > 0) {
    const replyItem = result.all_work_items.find(
      (row) => row.id === result.interruptions[0]?.inserted_work_item_id,
    )
    if (replyItem) {
      lines.push(`A customer reply came in, so I prioritized ${replyItem.title.toLowerCase()}.`)
    }
  }

  if (result.active_work && result.active_work.status === "working") {
    if (!lines.some((line) => line.includes(result.active_work!.title))) {
      lines.push(`Right now I'm ${result.active_work.title.toLowerCase().replace(/^review /, "reviewing ")}.`)
    }
  }

  const nextReady = result.work_plan.find(
    (entry) => entry.status === "ready" && entry.work_item_id !== result.active_work?.id,
  )
  if (nextReady && lines.length < 4) {
    lines.push(`While that's pending, I've continued with ${nextReady.title.toLowerCase()}.`)
  }

  if (lines.length === 0 && result.work_plan.length > 0) {
    for (const entry of result.work_plan.slice(0, 3)) {
      lines.push(entry.title.endsWith(".") ? entry.title : `${entry.title}.`)
    }
  }

  return lines.slice(0, 5)
}

export function buildWorkManagerSummary(result: AvaWorkManagerResult): string {
  return buildWorkManagerNarrativeLines(result).slice(0, 2).join(" ")
}
