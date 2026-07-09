/**
 * GE-AIOS-7A / GE-AIOS-14B — Unified Ava home hero (client-safe presentation builder).
 *
 * When workspace summary inputs are present, composes the canonical AI OS stack:
 * Memory → Decision → Work Manager → Specialist → Operating Rhythm → Narrative.
 * Without workspace summary, falls back to lightweight 7A presentation helpers.
 */

import { buildAvaDailyBriefing } from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { buildRelationshipLeadSnapshotsFromResearchLoop, mergeRelationshipLeadSnapshotMaps } from "@/lib/growth/relationship/project-relationship-graph-enrichment"
import {
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
  type AvaDailyBriefing,
  type AvaNarrativeMetricsSnapshot,
  type AvaStoryBlock,
} from "@/lib/growth/ava-home/narrative/narrative-types"
import { AVA_NARRATIVE_ALL_NORMAL_LINE } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { AvaMemorySummary, AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import type { AvaOperatingRhythm, AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import type { AvaSpecialistOrchestratorResult } from "@/lib/growth/specialists/types"
import { buildPrimaryDecisionFromWorkManager } from "@/lib/growth/work-manager/home/build-primary-decision-work"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeAiEmployeeStatus,
  GrowthHomeAiOsUxViewModel,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { extractFirstNameFromGreeting } from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { greetingForHour } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"

export const GROWTH_HOME_AVA_HERO_7A_QA_MARKER = "growth-ge-aios-7a-ava-home-experience-v1" as const

export const GROWTH_HOME_AVA_ALL_NORMAL_LINE = AVA_NARRATIVE_ALL_NORMAL_LINE
/** @deprecated GE-AIOS-14B — narrative engine replaces activity pills */
export const GROWTH_HOME_AVA_ONE_THING_TITLE = "I only need one thing from you" as const
/** @deprecated GE-AIOS-14B — narrative engine replaces activity pills */
export const GROWTH_HOME_AVA_CURRENTLY_TITLE = "Ava is currently" as const
/** @deprecated GE-AIOS-14B — narrative engine replaces since-last-visit list */
export const GROWTH_HOME_AVA_SINCE_LAST_VISIT_TITLE = "Since your last visit" as const

export type GrowthHomeAvaHeroActivity = { id: string; label: string }
export type GrowthHomeAvaHeroAccomplishment = { id: string; label: string }
export type GrowthHomeAvaHeroDecision = {
  id: string
  label: string
  detail: string | null
  href: string | null
}

export type GrowthHomeAvaHeroViewModel = {
  qaMarker: typeof GROWTH_HOME_AVA_HERO_7A_QA_MARKER
  greeting: string
  statusLabel: string
  statusKind: GrowthHomeAiEmployeeStatus["kind"]
  currentActivities: GrowthHomeAvaHeroActivity[]
  sinceLastVisit: GrowthHomeAvaHeroAccomplishment[]
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
  allNormalLine: string
  dailyBriefing?: AvaDailyBriefing
  storyBlocks: AvaStoryBlock[]
  briefingNarrative: string[]
  workManager?: AvaWorkManagerResult
  operatingRhythm?: AvaOperatingRhythm
  memorySummary?: AvaMemorySummary
  specialistOrchestrator?: AvaSpecialistOrchestratorResult | null
}

export type BuildAvaHomeHeroInput = {
  greeting: string
  hour: number
  employeeStatus: GrowthHomeAiEmployeeStatus
  aiOsUx: GrowthHomeAiOsUxViewModel
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  accomplishments: GrowthHomeAccomplishmentGroup[]
  repliesWaiting: number
  workspaceSummary?: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard" | "relationshipSnapshots" | "leadPool"
  >
  waitingOnYou?: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue?: GrowthHomeDailyWorkQueueItem[]
  timeline?: GrowthHomeTimelinePeriod[]
  previousSnapshot?: AvaNarrativeMetricsSnapshot | null
  operatingRhythmMemory?: AvaOperatingRhythmMemory | null
  persistedMemoryStore?: AvaOrganizationalMemoryStore | null
  organizationId?: string
  generatedAt?: string
  /** GE-AIOS-15E — explicit server snapshots (override research-loop projections) */
  relationshipSnapshotsById?: import("@/lib/growth/relationship/relationship-lead-snapshot-types").RelationshipLeadSnapshotMap
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/** GE-AIOS-7A — What Ava is doing now (Phase 4 dynamic status), from existing state. */
export function buildAvaCurrentActivities(input: {
  employeeStatus: GrowthHomeAiEmployeeStatus
  aiOsUx: GrowthHomeAiOsUxViewModel
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  repliesWaiting: number
}): GrowthHomeAvaHeroActivity[] {
  const { employeeStatus, aiOsUx, researchLoopSummary, repliesWaiting } = input
  const waitingCount = Math.max(aiOsUx.approveItemsCount, aiOsUx.waitingOnYou.length)
  const readyForReview = researchLoopSummary?.readyForOutreachReview ?? 0
  const researched = researchLoopSummary?.researchCompleted ?? 0

  const activities: GrowthHomeAvaHeroActivity[] = []

  if (employeeStatus.kind === "researching" || researched > 0 || aiOsUx.dailyWorkQueue.length > 0) {
    activities.push({ id: "researching", label: "Researching leads" })
  }
  if (employeeStatus.kind === "monitoring_replies" || repliesWaiting > 0) {
    activities.push({ id: "monitoring", label: "Monitoring replies" })
  }
  if (employeeStatus.kind === "preparing_outreach" || readyForReview > 0) {
    activities.push({ id: "preparing", label: "Preparing opportunities" })
  }
  if (employeeStatus.kind === "waiting_for_approval" || waitingCount > 0) {
    const label =
      waitingCount > 0
        ? `Waiting for ${waitingCount} ${pluralize(waitingCount, "approval", "approvals")}`
        : "Waiting for your approval"
    activities.push({ id: "waiting", label })
  }

  if (activities.length === 0) {
    activities.push({ id: "status", label: employeeStatus.label })
  }

  return activities
}

/** GE-AIOS-7A — What Ava accomplished (Phase 2 "Since your last visit"), from existing state. */
export function buildAvaSinceLastVisit(input: {
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  accomplishments: GrowthHomeAccomplishmentGroup[]
}): GrowthHomeAvaHeroAccomplishment[] {
  const { researchLoopSummary, accomplishments } = input
  const items: GrowthHomeAvaHeroAccomplishment[] = []

  if (researchLoopSummary) {
    const { researchCompleted, qualificationCompleted, readyForOutreachReview, buyingSignalsVerified } =
      researchLoopSummary
    if (researchCompleted > 0) {
      items.push({
        id: "researched",
        label: `researched ${researchCompleted} ${pluralize(researchCompleted, "company", "companies")}`,
      })
    }
    if (qualificationCompleted > 0) {
      items.push({ id: "qualified", label: `qualified ${qualificationCompleted}` })
    }
    if (readyForOutreachReview > 0) {
      items.push({
        id: "prepared",
        label: `prepared ${readyForOutreachReview} ${pluralize(readyForOutreachReview, "opportunity", "opportunities")}`,
      })
    }
    if (buyingSignalsVerified > 0) {
      items.push({
        id: "signals",
        label: `verified buying signals at ${buyingSignalsVerified} ${pluralize(buyingSignalsVerified, "company", "companies")}`,
      })
    }
  }

  for (const group of accomplishments) {
    for (const item of group.items) {
      if (items.length >= 4) break
      const trimmed = item.trim()
      if (!trimmed) continue
      const id = `${group.id}:${trimmed.slice(0, 32)}`
      if (items.some((existing) => existing.label.toLowerCase() === trimmed.toLowerCase())) continue
      items.push({ id, label: trimmed })
    }
  }

  return items.slice(0, 4)
}

/** GE-AIOS-7A — The single decision Ava needs (Phase 2 "one thing"), from existing approvals. */
export function buildAvaPrimaryDecision(aiOsUx: GrowthHomeAiOsUxViewModel): {
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
} {
  const top = aiOsUx.waitingOnYou[0] ?? null
  const totalWaiting = Math.max(aiOsUx.approveItemsCount, aiOsUx.waitingOnYou.length)

  if (!top && totalWaiting === 0) {
    return { primaryDecision: null, additionalDecisionCount: 0, reviewAllHref: null }
  }

  const primaryDecision: GrowthHomeAvaHeroDecision | null = top
    ? { id: top.id, label: top.label, detail: top.detail ?? null, href: top.href ?? aiOsUx.approveItemsHref }
    : {
        id: "approvals",
        label: `${totalWaiting} ${pluralize(totalWaiting, "item", "items")} waiting for your approval`,
        detail: null,
        href: aiOsUx.approveItemsHref,
      }

  const additionalDecisionCount = Math.max(0, totalWaiting - 1)

  return { primaryDecision, additionalDecisionCount, reviewAllHref: aiOsUx.approveItemsHref }
}

function mapPrimaryDecision(result: {
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
}) {
  return result
}

export function buildAvaHomeHero(input: BuildAvaHomeHeroInput): GrowthHomeAvaHeroViewModel {
  const firstName = extractFirstNameFromGreeting(input.greeting)
  const base = greetingForHour(input.hour)
  const greeting = firstName ? `${base}, ${firstName}.` : `${base}.`

  const legacyActivities = buildAvaCurrentActivities({
    employeeStatus: input.employeeStatus,
    aiOsUx: input.aiOsUx,
    researchLoopSummary: input.researchLoopSummary,
    repliesWaiting: input.repliesWaiting,
  })
  const legacySinceLastVisit = buildAvaSinceLastVisit({
    researchLoopSummary: input.researchLoopSummary,
    accomplishments: input.accomplishments,
  })

  if (!input.workspaceSummary) {
    const legacyDecision = buildAvaPrimaryDecision(input.aiOsUx)
    return {
      qaMarker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
      greeting,
      statusLabel: input.employeeStatus.label,
      statusKind: input.employeeStatus.kind,
      currentActivities: legacyActivities,
      sinceLastVisit: legacySinceLastVisit,
      primaryDecision: legacyDecision.primaryDecision,
      additionalDecisionCount: legacyDecision.additionalDecisionCount,
      reviewAllHref: legacyDecision.reviewAllHref,
      allNormalLine: GROWTH_HOME_AVA_ALL_NORMAL_LINE,
      storyBlocks: [],
      briefingNarrative: [],
    }
  }

  const researchSnapshots = buildRelationshipLeadSnapshotsFromResearchLoop(input.researchLoopSummary)
  const serverSnapshots =
    input.relationshipSnapshotsById ?? input.workspaceSummary?.relationshipSnapshots?.byLeadId ?? {}
  const leadSnapshotsById = mergeRelationshipLeadSnapshotMaps(researchSnapshots, serverSnapshots)

  const dailyBriefing = buildAvaDailyBriefing({
    greeting,
    hour: input.hour,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou ?? input.aiOsUx.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue ?? input.aiOsUx.dailyWorkQueue,
    timeline: input.timeline ?? [],
    previousSnapshot: input.previousSnapshot ?? null,
    operatingRhythmMemory: input.operatingRhythmMemory ?? null,
    persistedMemoryStore: input.persistedMemoryStore ?? null,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    leadSnapshotsById,
  })

  assertDailyBriefing(dailyBriefing)

  const workManager = dailyBriefing.work_manager_result
  const decision = workManager
    ? mapPrimaryDecision(buildPrimaryDecisionFromWorkManager(workManager, input.aiOsUx))
    : buildAvaPrimaryDecision(input.aiOsUx)

  const storyBlocks = dailyBriefing.story_blocks ?? []

  return {
    qaMarker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
    greeting,
    statusLabel: input.employeeStatus.label,
    statusKind: input.employeeStatus.kind,
    currentActivities: legacyActivities,
    sinceLastVisit: legacySinceLastVisit,
    primaryDecision: decision.primaryDecision,
    additionalDecisionCount: decision.additionalDecisionCount,
    reviewAllHref: decision.reviewAllHref,
    allNormalLine: GROWTH_HOME_AVA_ALL_NORMAL_LINE,
    dailyBriefing,
    storyBlocks,
    briefingNarrative: storyBlocks.map((block) => block.text),
    workManager,
    operatingRhythm: dailyBriefing.operating_rhythm_result,
    memorySummary: dailyBriefing.memory_result,
    specialistOrchestrator: dailyBriefing.specialist_orchestrator_result ?? null,
  }
}

function assertDailyBriefing(briefing: AvaDailyBriefing): void {
  if (briefing.qaMarker !== GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER) {
    throw new Error("Invalid Ava daily briefing marker")
  }
}
