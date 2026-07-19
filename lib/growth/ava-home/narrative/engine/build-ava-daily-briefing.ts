/** GE-AIOS-10A — Canonical Ava daily executive briefing engine (deterministic). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { resolveHomeDayPart } from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import {
  buildAvaNarrativeContext,
  buildAvaNarrativeMetricsSnapshotFromContext,
  type BuildAvaNarrativeContextInput,
} from "@/lib/growth/ava-home/narrative/context/build-ava-narrative-context"
import {
  buildSinceYesterdayLines,
} from "@/lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory"
import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import { buildSalesWorkloadScaleAcknowledgment } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { buildTodayPrioritiesFromWorkPlan } from "@/lib/growth/work-manager/bridges/narrative-bridge"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "@/lib/growth/work-manager/types"
import { runOperatingRhythm } from "@/lib/growth/operating-rhythm/engine/run-operating-rhythm"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "@/lib/growth/operating-rhythm/types"
import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import {
  buildAvaDailyActivityNarrative,
  dailyActivityLinesToStoryBlocks,
} from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "@/lib/growth/memory/types"
import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import { GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER } from "@/lib/growth/specialists/types"
import {
  buildAccomplishmentStories,
  buildTodayFocus,
  buildTodayPriorities,
} from "@/lib/growth/ava-home/narrative/stories/accomplishment-story"
import { buildApprovalStory } from "@/lib/growth/ava-home/narrative/stories/approval-story"
import { buildRiskStory } from "@/lib/growth/ava-home/narrative/stories/risk-story"
import { buildWaitingStory } from "@/lib/growth/ava-home/narrative/stories/waiting-story"
import {
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
  type AvaDailyBriefing,
  type AvaNarrativeContext,
  type AvaStoryBlock,
} from "@/lib/growth/ava-home/narrative/narrative-types"

export type BuildAvaDailyBriefingInput = {
  greeting: string
  hour: number
  workspaceSummary: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    | "kpis"
    | "meetings"
    | "inbox"
    | "operatorTasks"
    | "avaConsole"
    | "dashboard"
    | "leadPool"
    | "missionDiscovery"
    | "portfolioLeads"
    | "eligibleLeadCount"
  >
  accomplishments: GrowthHomeAccomplishmentGroup[]
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  timeline: GrowthHomeTimelinePeriod[]
  previousSnapshot?: AvaNarrativeMetricsSnapshot | null
  operatingRhythmMemory?: AvaOperatingRhythmMemory | null
  persistedMemoryStore?: AvaOrganizationalMemoryStore | null
  organizationId?: string
  generatedAt?: string
  leadSnapshotsById?: import("@/lib/growth/relationship/relationship-lead-snapshot-types").RelationshipLeadSnapshotMap
  /** GE-AIOS-OPERATOR-UX-1D — canonical pending approval count shared with Review queue. */
  pendingApprovalCount?: number
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  /** GE-AIOS-17C — Server-hydrated organizational knowledge */
  portfolioLeads?: import("@/lib/growth/types").GrowthLead[] | null
}

function appendScaleStoryBlock(
  blocks: AvaStoryBlock[],
  leadPool: BuildAvaDailyBriefingInput["workspaceSummary"]["leadPool"] | undefined,
): AvaStoryBlock[] {
  const line = leadPool ? buildSalesWorkloadScaleAcknowledgment(leadPool) : null
  if (!line) return blocks
  const scaleBlock: AvaStoryBlock = {
    id: "scale:lead_pool",
    kind: "mission",
    priority: 70,
    text: line.endsWith(".") ? line : `${line}.`,
    href: null,
  }
  if (blocks.some((row) => row.id === scaleBlock.id)) return blocks
  return [...blocks, scaleBlock]
}

function buildSupportingMetrics(context: AvaNarrativeContext): AvaDailyBriefing["supporting_metrics"] {
  const { metrics } = context
  return [
    { id: "researched", label: "Companies researched", value: String(metrics.researched) },
    { id: "qualified", label: "Companies qualified", value: String(metrics.qualified) },
    { id: "ready", label: "Ready for review", value: String(metrics.readyForReview) },
    { id: "replies", label: "Replies today", value: String(metrics.repliesToday) },
    { id: "meetings", label: "Meetings today", value: String(metrics.meetingsToday) },
    { id: "approvals", label: "Decisions waiting", value: String(metrics.approvalsWaiting) },
  ]
}

export function buildAvaDailyBriefing(input: BuildAvaDailyBriefingInput): AvaDailyBriefing {
  const contextInput: BuildAvaNarrativeContextInput = {
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
    pendingApprovalCount: input.pendingApprovalCount,
  }
  const context = buildAvaNarrativeContext(contextInput)
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const { summary: memorySummary, store: memoryStore } = runMemoryEngine({
    organizationId: input.organizationId,
    generatedAt,
    workspaceSummary: input.workspaceSummary,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    accomplishments: input.accomplishments,
    timeline: input.timeline,
    persistedStore: input.persistedMemoryStore ?? null,
    salesOutcomes: input.salesOutcomes?.outcomes ?? [],
    salesDailySummary: input.salesOutcomes?.dailySummary ?? null,
    organizationalKnowledge: input.organizationalKnowledge ?? null,
    adapters: {
      previousSnapshot: input.previousSnapshot ?? null,
      operatingRhythmMemory: input.operatingRhythmMemory ?? null,
    },
  })
  const workResult = runWorkManager({
    workspaceSummary: input.workspaceSummary,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    accomplishments: input.accomplishments,
    timeline: input.timeline,
    generatedAt,
    leadSnapshotsById: input.leadSnapshotsById,
    memorySummary,
    organizationId: input.organizationId ?? null,
    portfolioLeads: input.portfolioLeads ?? input.workspaceSummary.portfolioLeads ?? null,
  })
  const eligibleLeadCount =
    input.workspaceSummary.eligibleLeadCount ??
    input.portfolioLeads?.length ??
    input.workspaceSummary.portfolioLeads?.length ??
    null
  const currentSnapshot = buildAvaNarrativeMetricsSnapshotFromContext(context)
  const since_yesterday = buildSinceYesterdayLines(currentSnapshot, input.previousSnapshot ?? null)
  const operatingRhythm = runOperatingRhythm({
    hour: input.hour,
    workResult,
    metrics: context.metrics,
    sinceYesterday: since_yesterday,
    previousMemory: input.operatingRhythmMemory ?? null,
  })
  const daily_activity_narrative = buildAvaDailyActivityNarrative({
    memorySummary,
    salesDailySummary: input.salesOutcomes?.dailySummary ?? null,
    pendingApprovalCount:
      input.pendingApprovalCount ?? input.salesOutcomes?.dailySummary?.approvals_pending,
    workResult,
    operatingRhythm,
    specialistOrchestrator: workResult.specialist_orchestrator_result ?? null,
    hour: input.hour,
    repliesToday: context.metrics.repliesToday,
    setupIncomplete: context.businessUnderstanding.profileIncomplete,
    missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
    eligibleLeadCount,
  })
  const story_blocks = appendScaleStoryBlock(
    dailyActivityLinesToStoryBlocks(daily_activity_narrative),
    input.workspaceSummary.leadPool,
  )
  const wins = buildAccomplishmentStories(context)
  const risks = context.risks.map((fact) => buildRiskStory(fact)).filter(Boolean) as AvaStoryBlock[]
  const waiting_on_user = [
    ...context.approvalsWaiting.map((fact) => buildApprovalStory([fact])).filter(Boolean),
    ...context.inboxWaiting.map((fact) => buildWaitingStory(fact)).filter(Boolean),
  ] as AvaStoryBlock[]

  const todayPrioritiesFromWork = buildTodayPrioritiesFromWorkPlan(workResult)

  const scaleLine = input.workspaceSummary.leadPool
    ? buildSalesWorkloadScaleAcknowledgment(input.workspaceSummary.leadPool)
    : null
  const baseSummary = daily_activity_narrative.summary

  return {
    qaMarker: GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
    title: input.greeting,
    summary: scaleLine ? `${baseSummary} ${scaleLine}`.trim() : baseSummary,
    daily_activity_narrative,
    story_blocks,
    top_priority: story_blocks[0] ?? null,
    waiting_on_user,
    today_focus: buildTodayFocus(context),
    today_priorities:
      todayPrioritiesFromWork.length > 0 ? todayPrioritiesFromWork : buildTodayPriorities(context),
    since_yesterday,
    risks,
    wins,
    supporting_metrics: buildSupportingMetrics(context),
    metrics_snapshot: currentSnapshot,
    work_manager_qa_marker: GROWTH_WORK_MANAGER_QA_MARKER,
    work_manager_result: workResult,
    operating_rhythm_qa_marker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
    operating_rhythm_result: operatingRhythm,
    memory_qa_marker: GROWTH_MEMORY_ENGINE_QA_MARKER,
    memory_result: memorySummary,
    memory_store: memoryStore,
    specialist_orchestrator_qa_marker: GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
    specialist_orchestrator_result: workResult.specialist_orchestrator_result ?? null,
  }
}

/** Future AI hook — polish wording only; facts remain unchanged. */
export type AvaNarrativeEnhancer = (briefing: AvaDailyBriefing) => AvaDailyBriefing

export function applyAvaNarrativeEnhancer(
  briefing: AvaDailyBriefing,
  enhancer?: AvaNarrativeEnhancer | null,
): AvaDailyBriefing {
  if (!enhancer) return briefing
  return enhancer(briefing)
}

export function resolveNarrativeDayPartFocus(hour: number): string {
  const dayPart = resolveHomeDayPart(hour)
  if (dayPart === "morning") return "Today I focused on catching up on research and preparing opportunities."
  return "Today I focused on researching companies and preparing opportunities."
}

export { buildAvaNarrativeMetricsSnapshotFromContext }
