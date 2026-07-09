/** GE-AIOS-10A — Canonical Ava daily executive briefing engine (deterministic). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
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
import { buildRelationshipContextClause } from "@/lib/growth/relationship/relationship-narrative-copy"
import { buildSalesWorkloadScaleAcknowledgment } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import {
  buildTodayPrioritiesFromWorkPlan,
  buildWorkManagerSummary,
  mapWorkPlanToStoryPriority,
} from "@/lib/growth/work-manager/bridges/narrative-bridge"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "@/lib/growth/work-manager/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { runOperatingRhythm } from "@/lib/growth/operating-rhythm/engine/run-operating-rhythm"
import {
  buildOperatingRhythmNarrativeLines,
  buildOperatingRhythmStoryBlocks,
} from "@/lib/growth/operating-rhythm/bridges/narrative-bridge"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "@/lib/growth/operating-rhythm/types"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"
import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import {
  buildMemoryNarrativeLines,
  buildMemoryStoryBlocks,
} from "@/lib/growth/memory/bridges/narrative-memory"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "@/lib/growth/memory/types"
import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import { buildSpecialistStoryBlocks } from "@/lib/growth/specialists/bridges/narrative-bridge"
import { GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER } from "@/lib/growth/specialists/types"
import {
  buildAccomplishmentStories,
  buildTodayFocus,
  buildTodayPriorities,
} from "@/lib/growth/ava-home/narrative/stories/accomplishment-story"
import { buildApprovalStory } from "@/lib/growth/ava-home/narrative/stories/approval-story"
import { buildDiscoveryStory } from "@/lib/growth/ava-home/narrative/stories/discovery-story"
import { buildOpportunityStory } from "@/lib/growth/ava-home/narrative/stories/opportunity-story"
import { buildRiskStory } from "@/lib/growth/ava-home/narrative/stories/risk-story"
import {
  buildMeetingStory,
  buildMissionStory,
  buildReplyStory,
  buildResearchStory,
  buildWaitingStory,
} from "@/lib/growth/ava-home/narrative/stories/waiting-story"
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
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard" | "leadPool"
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
}

function findFact(context: AvaNarrativeContext, factId: string) {
  const pools = [
    context.approvalsWaiting,
    context.repliesReceived,
    context.meetingsBooked,
    context.opportunities,
    context.discoveries,
    context.inboxWaiting,
    context.missionsRunning,
    context.risks,
    context.accomplishments,
    context.activityTimeline,
  ]
  for (const pool of pools) {
    const match = pool.find((row) => row.id === factId)
    if (match) return match
  }
  return null
}

function buildStoryBlockFromPriority(context: AvaNarrativeContext, factId: string, kind: AvaStoryBlock["kind"]): AvaStoryBlock | null {
  const fact = findFact(context, factId)

  if (kind === "approval") {
    return buildApprovalStory(context.approvalsWaiting)
  }
  if (kind === "reply" && fact) {
    return buildReplyStory(fact)
  }
  if (kind === "meeting" && fact) {
    return buildMeetingStory(fact)
  }
  if (kind === "opportunity" && fact) {
    return buildOpportunityStory(fact)
  }
  if (kind === "discovery" && fact) {
    return buildDiscoveryStory(fact)
  }
  if (kind === "research") {
    const industry = context.discoveries.find((row) => row.industry)?.industry ?? null
    return buildResearchStory(context.metrics.researched, industry)
  }
  if (kind === "mission" && fact) {
    return buildMissionStory(fact)
  }
  if (kind === "waiting" && fact) {
    return buildWaitingStory(fact)
  }
  return null
}

function buildStoryBlockFromWorkItem(
  workResult: AvaWorkManagerResult,
  factId: string,
  kind: AvaStoryBlock["kind"],
): AvaStoryBlock | null {
  const item = workResult.all_work_items.find((row) => row.decision_source_id === factId || row.id === factId)
  if (!item) return null

  const relationshipLine = buildRelationshipContextClause(item.relationship_graph, item.company_name)
  const baseText = item.title.trim().endsWith(".") ? item.title.trim() : `${item.title.trim()}.`
  const text = relationshipLine ?? baseText

  return {
    id: `work:${item.id}`,
    kind,
    priority: item.decision_score,
    text,
    href: item.href,
  }
}

function mergeBriefingStoryBlocks(...groups: AvaStoryBlock[][]): AvaStoryBlock[] {
  const merged: AvaStoryBlock[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const block of group) {
      if (seen.has(block.text)) continue
      seen.add(block.text)
      merged.push(block)
      if (merged.length >= 5) return merged
    }
  }

  return merged
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

function buildNarrativeStoryBlocks(
  context: AvaNarrativeContext,
  workResult: AvaWorkManagerResult,
  operatingRhythm: AvaOperatingRhythm,
  hour: number,
  memorySummary: import("@/lib/growth/memory/types").AvaMemorySummary | null,
): AvaStoryBlock[] {
  const rhythmBlocks = buildOperatingRhythmStoryBlocks(operatingRhythm, workResult, hour)
  const specialistBlocks = buildSpecialistStoryBlocks(workResult.specialist_orchestrator_result)
  const memoryBlocks = buildMemoryStoryBlocks(memorySummary)
  const merged = mergeBriefingStoryBlocks(rhythmBlocks, specialistBlocks, memoryBlocks)
  if (merged.length > 0) return merged

  const prioritized = mapWorkPlanToStoryPriority(workResult)
  const blocks: AvaStoryBlock[] = []
  const usedKinds = new Set<AvaStoryBlock["kind"]>()

  for (const candidate of prioritized) {
    if (candidate.kind === "approval" && usedKinds.has("approval")) continue
    if (candidate.kind === "discovery") {
      const discoveryCount = blocks.filter((row) => row.kind === "discovery").length
      if (discoveryCount >= 2) continue
    }
    if (candidate.kind === "opportunity" && usedKinds.has("opportunity")) continue
    if (candidate.kind === "mission" && usedKinds.has("mission")) continue

    let block = buildStoryBlockFromPriority(context, candidate.factId, candidate.kind)
    if (!block) {
      block = buildStoryBlockFromWorkItem(workResult, candidate.factId, candidate.kind)
    }
    if (!block) continue
    if (blocks.some((row) => row.text === block.text)) continue

    blocks.push(block)
    usedKinds.add(candidate.kind)
    if (blocks.length >= 5) break
  }

  if (blocks.length === 0) {
    const mission = buildMissionStory(context.missionsRunning[0] ?? { id: "default", kind: "mission", label: "pipeline_mission" })
    if (mission) blocks.push(mission)
  }

  return blocks
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

function buildSummary(storyBlocks: AvaStoryBlock[]): string {
  return storyBlocks
    .slice(0, 2)
    .map((block) => block.text)
    .join(" ")
}

export function buildAvaDailyBriefing(input: BuildAvaDailyBriefingInput): AvaDailyBriefing {
  const contextInput: BuildAvaNarrativeContextInput = {
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
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
  })
  const currentSnapshot = buildAvaNarrativeMetricsSnapshotFromContext(context)
  const since_yesterday = buildSinceYesterdayLines(currentSnapshot, input.previousSnapshot ?? null)
  const operatingRhythm = runOperatingRhythm({
    hour: input.hour,
    workResult,
    metrics: context.metrics,
    sinceYesterday: since_yesterday,
    previousMemory: input.operatingRhythmMemory ?? null,
  })
  const story_blocks = appendScaleStoryBlock(
    buildNarrativeStoryBlocks(context, workResult, operatingRhythm, input.hour, memorySummary),
    input.workspaceSummary.leadPool,
  )
  const wins = buildAccomplishmentStories(context)
  const risks = context.risks.map((fact) => buildRiskStory(fact)).filter(Boolean) as AvaStoryBlock[]
  const waiting_on_user = [
    ...context.approvalsWaiting.map((fact) => buildApprovalStory([fact])).filter(Boolean),
    ...context.inboxWaiting.map((fact) => buildWaitingStory(fact)).filter(Boolean),
  ] as AvaStoryBlock[]

  const todayPrioritiesFromWork = buildTodayPrioritiesFromWorkPlan(workResult)
  const memorySummaryLine = buildMemoryNarrativeLines(memorySummary)[0] ?? null
  const rhythmSummary = buildOperatingRhythmNarrativeLines(operatingRhythm, workResult, input.hour)
    .slice(0, 2)
    .join(" ")

  const scaleLine = input.workspaceSummary.leadPool
    ? buildSalesWorkloadScaleAcknowledgment(input.workspaceSummary.leadPool)
    : null
  const baseSummary =
    memorySummaryLine || rhythmSummary || buildWorkManagerSummary(workResult) || buildSummary(story_blocks)

  return {
    qaMarker: GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
    title: input.greeting,
    summary: scaleLine ? `${baseSummary} ${scaleLine}`.trim() : baseSummary,
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
