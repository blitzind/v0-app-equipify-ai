/** GE-AIOS-19A — Sales Operations Center view model (canonical stack presentation only). */

import type { AvaDailyBriefing } from "@/lib/growth/ava-home/narrative/narrative-types"
import { runDecisionEngine } from "@/lib/growth/decision-engine/engine/run-decision-engine"
import type { BuildDecisionContextInput } from "@/lib/growth/decision-engine/context/build-decision-context"
import type { DecisionActionKind, DecisionEngineResult } from "@/lib/growth/decision-engine/types"
import {
  buildHomeDefaultSpecialistTeamStatus,
  buildHomeWorkItemPresentation,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { buildSalesOperationsCenterDecisionExplanation } from "@/lib/growth/operations-center/growth-sales-operations-center-decision-narrative"
import {
  GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER,
  type GrowthSalesOperationsCenterViewModel,
  type SalesOperationsCenterConfidenceRow,
  type SalesOperationsCenterFocus,
  type SalesOperationsCenterWaitingItem,
} from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import type { AvaWorkItem, AvaWorkItemType, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

const QUEUE_BUCKET_DEFS: Array<{ id: string; label: string; types: AvaWorkItemType[] }> = [
  { id: "research", label: "Research", types: ["research"] },
  { id: "qualification", label: "Qualification", types: ["qualification"] },
  { id: "outreach", label: "Outreach", types: ["outreach", "approval"] },
  { id: "follow_up", label: "Follow-up", types: ["reply"] },
  { id: "meetings", label: "Meetings", types: ["meeting"] },
]

const CONFIDENCE_LABELS: Array<{ id: string; label: string; kinds: DecisionActionKind[]; types: AvaWorkItemType[] }> =
  [
    { id: "research", label: "Research", kinds: ["research_company"], types: ["research"] },
    { id: "qualification", label: "Qualification", kinds: ["continue_qualification"], types: ["qualification"] },
    { id: "follow_up", label: "Follow-up", kinds: ["review_reply"], types: ["reply"] },
    { id: "outreach", label: "Outreach", kinds: ["prepare_outreach", "review_approval"], types: ["outreach", "approval"] },
    { id: "meetings", label: "Meeting Prep", kinds: ["meeting_prep"], types: ["meeting"] },
  ]

function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function sumEstimatedMinutes(items: AvaWorkItem[]): number | null {
  const values = items
    .map((row) => row.estimated_minutes)
    .filter((value): value is number => typeof value === "number" && value > 0)
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0)
}

function buildFocus(input: {
  workManager: AvaWorkManagerResult
  decisionExplanation: ReturnType<typeof buildSalesOperationsCenterDecisionExplanation>
}): SalesOperationsCenterFocus | null {
  const active = input.workManager.active_work
  if (!active) return null

  const presentation = buildHomeWorkItemPresentation(active)
  const remainingItems = input.workManager.work_plan
    .filter((entry) => entry.status === "ready" || entry.status === "working")
    .map((entry) => input.workManager.all_work_items.find((row) => row.id === entry.work_item_id))
    .filter((row): row is AvaWorkItem => Boolean(row))

  const remainingCount = remainingItems.length
  const estimatedCompletionMinutes = sumEstimatedMinutes([active, ...remainingItems])

  return {
    title: presentation.companyName ?? presentation.title,
    remainingLabel:
      remainingCount > 0
        ? `${remainingCount} ${remainingCount === 1 ? "item" : "items"} remaining in today's plan`
        : null,
    estimatedCompletionMinutes,
    reason: input.decisionExplanation?.headline ?? presentation.whyItMatters,
  }
}

function buildQueueBuckets(workManager: AvaWorkManagerResult) {
  return QUEUE_BUCKET_DEFS.map((bucket) => {
    const queued = workManager.all_work_items.filter(
      (row) => bucket.types.includes(row.type) && (row.status === "ready" || row.status === "planned"),
    ).length
    const active = workManager.all_work_items.filter(
      (row) =>
        bucket.types.includes(row.type) &&
        (row.status === "working" || workManager.active_work?.id === row.id),
    ).length
    const completedToday = workManager.completed_today.filter((row) => bucket.types.includes(row.type)).length
    return { ...bucket, queued, active, completedToday }
  })
}

function buildWaitingItems(input: {
  workManager: AvaWorkManagerResult
  operatingRhythmWaiting: string[]
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  mailboxWarnings?: number
}): SalesOperationsCenterWaitingItem[] {
  const items: SalesOperationsCenterWaitingItem[] = []

  for (const item of input.workManager.operator_queue) {
    const presentation = buildHomeWorkItemPresentation(item)
    items.push({
      id: item.id,
      label: presentation.title,
      detail: presentation.whyItMatters ?? item.description,
      href: item.href,
    })
  }

  for (const line of input.operatingRhythmWaiting) {
    if (items.some((row) => row.label === line)) continue
    items.push({ id: `rhythm:${line}`, label: line, detail: null, href: null })
  }

  if (input.missionDiscovery?.discoveryAction === "refresh_audience") {
    const target =
      input.missionDiscovery.audienceName?.trim() || input.missionDiscovery.searchSummary?.trim() || "audience"
    items.push({
      id: "discovery:audience_refresh",
      label: "Audience refresh",
      detail: `Monitoring and refreshing our ${target} audience for new companies.`,
      href: null,
    })
  }

  if ((input.mailboxWarnings ?? 0) > 0) {
    items.push({
      id: "mailbox:warnings",
      label: "Mailbox attention needed",
      detail: `${input.mailboxWarnings} mailbox ${input.mailboxWarnings === 1 ? "issue needs" : "issues need"} review before outreach can send.`,
      href: "/growth/settings/communications/connected-mailboxes",
    })
  }

  return items.slice(0, 8)
}

function averageConfidence(values: number[]): number | null {
  const filtered = values.filter((value) => value > 0)
  if (filtered.length === 0) return null
  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

function buildConfidenceRows(input: {
  workManager: AvaWorkManagerResult
  decisionResult: DecisionEngineResult
}): SalesOperationsCenterConfidenceRow[] {
  const rows: SalesOperationsCenterConfidenceRow[] = []

  for (const def of CONFIDENCE_LABELS) {
    const workConfidences = input.workManager.all_work_items
      .filter((row) => def.types.includes(row.type))
      .map((row) => row.confidence)
    const decisionConfidences = input.decisionResult.next_best_actions
      .filter((row) => def.kinds.includes(row.kind))
      .map((row) => row.confidence)

    const percent = averageConfidence([...workConfidences, ...decisionConfidences])
    if (percent == null) continue
    rows.push({ id: def.id, label: def.label, percent })
  }

  return rows
}

function buildTimeline(input: {
  memoryEvents: AvaMemoryEvent[]
  completedToday: AvaWorkItem[]
  generatedAt: string
}) {
  const entries = [
    ...input.memoryEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      timeLabel: formatTimeLabel(event.timestamp),
      summary: event.summary.replace(/\.$/, ""),
    })),
    ...input.completedToday.map((item) => {
      const presentation = buildHomeWorkItemPresentation(item)
      return {
        id: `completed:${item.id}`,
        timestamp: item.updated_at || input.generatedAt,
        timeLabel: formatTimeLabel(item.updated_at || input.generatedAt),
        summary: presentation.companyName ?? presentation.title,
      }
    }),
  ]

  return entries
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 12)
}

export type BuildGrowthSalesOperationsCenterInput = {
  dailyBriefing: AvaDailyBriefing
  decisionContext: BuildDecisionContextInput
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  mailboxWarnings?: number
  generatedAt?: string
}

export function buildGrowthSalesOperationsCenterViewModel(
  input: BuildGrowthSalesOperationsCenterInput,
): GrowthSalesOperationsCenterViewModel {
  const workManager = input.dailyBriefing.work_manager_result
  if (!workManager) {
    return {
      qaMarker: GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER,
      executiveSummaryLine: input.dailyBriefing.summary?.trim() ?? null,
      focus: null,
      recentlyCompleted: [],
      queueBuckets: QUEUE_BUCKET_DEFS.map((bucket) => ({ ...bucket, queued: 0, active: 0, completedToday: 0 })),
      waitingItems: [],
      decisionExplanation: null,
      confidence: [],
      timeline: [],
      specialistTeam: buildHomeDefaultSpecialistTeamStatus(),
      workingNextLines: [],
    }
  }

  const decisionResult = runDecisionEngine({
    ...input.decisionContext,
    memorySummary: input.dailyBriefing.memory_result ?? null,
  })
  const decisionExplanation = buildSalesOperationsCenterDecisionExplanation({
    decisionResult,
    missionDiscovery: input.missionDiscovery ?? null,
  })
  const narrative = input.dailyBriefing.daily_activity_narrative
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  const recentlyCompleted = [
    ...(narrative?.completed_today ?? []),
    ...workManager.completed_today
      .map((item) => buildHomeWorkItemPresentation(item).companyName ?? item.title)
      .filter((line) => !(narrative?.completed_today ?? []).some((row) => row === line)),
  ].slice(0, 8)

  const specialistTeam =
    input.dailyBriefing.specialist_orchestrator_result?.team_status?.length
      ? input.dailyBriefing.specialist_orchestrator_result.team_status
      : buildHomeDefaultSpecialistTeamStatus()

  return {
    qaMarker: GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER,
    executiveSummaryLine: narrative?.working_now[0] ?? input.dailyBriefing.summary?.trim() ?? null,
    focus: buildFocus({ workManager, decisionExplanation }),
    recentlyCompleted,
    queueBuckets: buildQueueBuckets(workManager),
    waitingItems: buildWaitingItems({
      workManager,
      operatingRhythmWaiting: input.dailyBriefing.operating_rhythm_result?.waiting_on_operator ?? [],
      missionDiscovery: input.missionDiscovery ?? null,
      mailboxWarnings: input.mailboxWarnings,
    }),
    decisionExplanation,
    confidence: buildConfidenceRows({ workManager, decisionResult }),
    timeline: buildTimeline({
      memoryEvents: input.dailyBriefing.memory_result?.recent_events ?? [],
      completedToday: workManager.completed_today,
      generatedAt,
    }),
    specialistTeam,
    workingNextLines: narrative?.working_next ?? [],
  }
}
