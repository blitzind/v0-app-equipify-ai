/** GE-AIOS-17D / GE-AIOS-18F — Ava Daily Activity Narrative (canonical briefing sentences). */

import type {
  AvaDailyActivityLine,
  AvaDailyActivityNarrative,
  AvaDailyActivitySection,
} from "@/lib/growth/ava-home/narrative/narrative-types"
import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import {
  buildNarrativeIntelligenceWaitingFallback,
  NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE,
  NARRATIVE_INTELLIGENCE_EMPTY_QUEUE_MESSAGE,
  NARRATIVE_INTELLIGENCE_SECTION_LABELS,
  NARRATIVE_INTELLIGENCE_SETUP_INCOMPLETE_MESSAGE,
  resolveNarrativeIntelligenceFocus,
  resolveNarrativeIntelligenceSectionOrder,
} from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { buildKnowledgeNarrativeLines } from "@/lib/growth/memory/knowledge/build-organizational-knowledge"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaSpecialistOrchestratorResult } from "@/lib/growth/specialists/types"
import { buildPhaseAwareNarrativeLine } from "@/lib/growth/operating-rhythm/bridges/narrative-bridge"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import {
  buildLeadDiscoveryCompletedLine,
  buildLeadDiscoveryWorkingNextLine,
  buildLeadDiscoveryWorkingNowLine,
  resolveLeadDiscoveryNarrativeFocus,
} from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"

export const GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER =
  "ge-aios-17d-daily-activity-narrative-v1" as const

export const AVA_DAILY_ACTIVITY_SECTION_LABELS: Record<AvaDailyActivitySection, string> =
  NARRATIVE_INTELLIGENCE_SECTION_LABELS

export const AVA_DAILY_ACTIVITY_SECTION_ORDER: AvaDailyActivitySection[] = [
  "completed_today",
  "working_now",
  "waiting_on_you",
  "learned_today",
  "working_next",
]

function sentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`
}

function pushLine(
  lines: AvaDailyActivityLine[],
  section: AvaDailyActivitySection,
  text: string,
  href?: string | null,
): void {
  const normalized = sentence(text)
  if (!normalized || lines.some((row) => row.section === section && row.text === normalized)) return
  lines.push({ section, text: normalized, href: href ?? null })
}

function companyFromWorkTitle(title: string): string | null {
  const company = title.replace(/^(Research company|Prepare outreach|Continue qualification)\s+—\s+/i, "").trim()
  return company && company !== title ? company : null
}

function describeActiveWork(item: AvaWorkItem): string {
  const company = item.company_name?.trim() || companyFromWorkTitle(item.title)
  if (item.type === "research" && company) {
    return `I'm researching ${company}.`
  }
  if (item.type === "outreach" && company) {
    return `I'm preparing personalized outreach for ${company}.`
  }
  if (item.type === "reply" && company) {
    return `I'm reviewing follow-up opportunities with ${company}.`
  }
  if (item.type === "qualification" && company) {
    return `I'm reviewing qualification for ${company}.`
  }
  const title = item.title.trim().replace(/\.$/, "")
  return `I'm ${title.charAt(0).toLowerCase()}${title.slice(1)}.`
}

/** Completed work — Memory / Sales Outcomes only (no invented activity). */
export function buildDailyActivityCompletedLines(input: {
  memorySummary: AvaMemorySummary | null | undefined
  salesDailySummary?: SalesOutcomeDailySummary | null
  repliesToday?: number
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): string[] {
  const lines: string[] = []
  const discoveryCompleted = buildLeadDiscoveryCompletedLine(input.missionDiscovery)
  if (discoveryCompleted) lines.push(discoveryCompleted)
  const dailySummary = input.salesDailySummary

  if (dailySummary) {
    if (dailySummary.researched > 0) {
      lines.push(
        `I researched ${dailySummary.researched} ${pluralize(dailySummary.researched, "company", "companies")}.`,
      )
    }
    if (dailySummary.qualified > 0) {
      lines.push(`I qualified ${dailySummary.qualified} ${pluralize(dailySummary.qualified, "opportunity", "opportunities")}.`)
    }
    if (dailySummary.strong_opportunities > 0) {
      lines.push(
        `I identified ${dailySummary.strong_opportunities} strong ${pluralize(dailySummary.strong_opportunities, "opportunity", "opportunities")}.`,
      )
    }
    if (dailySummary.outreach_prepared > 0) {
      lines.push(
        `I prepared ${dailySummary.outreach_prepared} outreach ${pluralize(dailySummary.outreach_prepared, "draft", "drafts")}.`,
      )
    }
    if (dailySummary.meetings_prepared > 0) {
      lines.push(
        `I prepared ${dailySummary.meetings_prepared} meeting ${pluralize(dailySummary.meetings_prepared, "brief", "briefs")}.`,
      )
    }
    if (lines.length > 0) {
      const replies = Math.max(input.repliesToday ?? 0, 0)
      if (replies > 0) {
        lines.push(`I reviewed ${replies} ${pluralize(replies, "reply", "replies")} from yesterday.`)
      }
      return lines.slice(0, 5)
    }
  }

  const salesEvents = (input.memorySummary?.recent_events ?? []).filter(
    (row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE,
  )
  if (salesEvents.length > 0) {
    const researched = salesEvents.filter((row) => row.metadata.outcome_type === "research_completed").length
    const qualified = salesEvents.filter((row) => row.metadata.outcome_type === "qualification_completed").length
    const outreachPrepared = salesEvents.filter((row) => row.metadata.outcome_type === "outreach_prepared").length

    if (researched > 0) {
      lines.push(`I researched ${researched} ${pluralize(researched, "company", "companies")}.`)
    }
    if (qualified > 0) {
      lines.push(`I qualified ${qualified} ${pluralize(qualified, "opportunity", "opportunities")}.`)
    }
    if (outreachPrepared > 0) {
      lines.push(`I prepared ${outreachPrepared} outreach ${pluralize(outreachPrepared, "draft", "drafts")}.`)
    }
  }

  const replies = Math.max(input.repliesToday ?? 0, 0)
  if (replies > 0 && lines.length < 4) {
    lines.push(`I reviewed ${replies} ${pluralize(replies, "reply", "replies")} from yesterday.`)
  }

  return lines.slice(0, 5)
}

/** Learned insights — Organizational Knowledge only. */
export function buildDailyActivityLearnedLines(
  memorySummary: AvaMemorySummary | null | undefined,
): string[] {
  return buildKnowledgeNarrativeLines(memorySummary?.organizational_knowledge ?? []).slice(0, 2)
}

/** Waiting on operator — Work Manager queue only. */
export function buildDailyActivityWaitingLines(input: {
  workResult: AvaWorkManagerResult
  salesDailySummary?: SalesOutcomeDailySummary | null
}): string[] {
  const lines: string[] = []
  const approvalItems = input.workResult.operator_queue.filter((row) => row.type === "approval")
  const approvalCount = approvalItems.length || input.salesDailySummary?.approvals_pending || 0

  if (approvalCount > 0) {
    lines.push(
      `I have ${approvalCount} outreach ${pluralize(approvalCount, "draft", "drafts")} ready for your approval.`,
    )
    lines.push("I need your approval before I can continue.")
  }

  const replyItems = input.workResult.operator_queue.filter((row) => row.type === "reply")
  if (replyItems.length > 0) {
    lines.push(
      `${replyItems.length} ${pluralize(replyItems.length, "reply needs", "replies need")} your review before I can continue.`,
    )
  }

  const otherWaiting = input.workResult.operator_queue.filter(
    (row) => row.type !== "approval" && row.type !== "reply",
  )
  if (otherWaiting.length > 0 && lines.length === 0) {
    lines.push(
      `I'm blocked on ${otherWaiting.length} ${pluralize(otherWaiting.length, "decision", "decisions")} before I can continue.`,
    )
  }

  return lines.slice(0, 2)
}

/** Current work — active Work Manager item + specialist runtime. */
export function buildDailyActivityWorkingNowLines(input: {
  workResult: AvaWorkManagerResult
  operatingRhythm: AvaOperatingRhythm
  specialistOrchestrator?: AvaSpecialistOrchestratorResult | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): string[] {
  const lines: string[] = []
  const activeWork = input.workResult.active_work

  if (activeWork && (activeWork.status === "working" || activeWork.status === "ready")) {
    lines.push(describeActiveWork(activeWork))
  }

  if (lines.length === 0) {
    const discoveryLine = buildLeadDiscoveryWorkingNowLine(input.missionDiscovery)
    if (discoveryLine) lines.push(discoveryLine)
  }

  const salesStatus = input.specialistOrchestrator?.team_status.find((row) => row.specialist_id === "sales")
  if (lines.length === 0 && salesStatus && salesStatus.active_count > 0 && !salesStatus.is_stub) {
    const label = salesStatus.status_label.trim()
    if (label && !/^no active work/i.test(label)) {
      const normalized = /^i['']?m /i.test(label) ? label : `I'm ${label.charAt(0).toLowerCase()}${label.slice(1)}`
      lines.push(normalized.endsWith(".") ? normalized : `${normalized}.`)
    }
  }

  if (lines.length === 0 && input.operatingRhythm.active_cycle?.summary?.trim()) {
    lines.push(input.operatingRhythm.active_cycle.summary)
  }

  return lines.slice(0, 2)
}

/** What's next — Work Manager plan + Operating Rhythm (future work only). */
export function buildDailyActivityWorkingNextLines(input: {
  workResult: AvaWorkManagerResult
  operatingRhythm: AvaOperatingRhythm
  hour: number
  setupIncomplete?: boolean
  setupBlockingSummary?: string | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): string[] {
  const lines: string[] = []

  if (input.setupIncomplete) {
    lines.push(input.setupBlockingSummary?.trim() || NARRATIVE_INTELLIGENCE_SETUP_INCOMPLETE_MESSAGE)
    return lines
  }

  const readyPlan = input.workResult.work_plan.filter((row) => row.status === "ready")
  const activeId = input.workResult.active_work?.id

  if (readyPlan.length > 0) {
    const nextEntry = readyPlan.find((row) => row.work_item_id !== activeId) ?? readyPlan[0]
    const nextItem = input.workResult.all_work_items.find((row) => row.id === nextEntry.work_item_id)
    if (nextItem) {
      const company = nextItem.company_name?.trim() || companyFromWorkTitle(nextItem.title)
      if (nextItem.type === "research" && company) {
        lines.push(`Next I'll continue researching ${company}.`)
      } else if (nextItem.type === "outreach" && company) {
        lines.push(`Next I'll prepare outreach for ${company}.`)
      } else if (nextItem.type === "reply") {
        lines.push(`Next I'll follow up with existing prospects.`)
      } else {
        const title = nextItem.title.trim().replace(/\.$/, "")
        lines.push(`Next I'll ${title.charAt(0).toLowerCase()}${title.slice(1)}.`)
      }
    } else if (readyPlan.length > 1) {
      lines.push(
        `Next I'll continue working through ${readyPlan.length} remaining ${pluralize(readyPlan.length, "account", "accounts")} in today's plan.`,
      )
    }
  }

  if (lines.length === 0 && input.workResult.work_plan.length > 0) {
    const phaseLine = buildPhaseAwareNarrativeLine(input.operatingRhythm, input.hour)
    if (phaseLine && !/continuing through today's operating plan/i.test(phaseLine)) {
      const normalized = phaseLine.replace(/^I'?ve been /i, "Next I'll keep ")
      lines.push(normalized.endsWith(".") ? normalized : `${normalized}.`)
    }
  }

  if (lines.length === 0 && input.workResult.work_plan.length === 0 && input.workResult.operator_queue.length === 0) {
    const discoveryNext = buildLeadDiscoveryWorkingNextLine(input.missionDiscovery)
    if (discoveryNext) {
      lines.push(discoveryNext)
    } else {
      lines.push(NARRATIVE_INTELLIGENCE_EMPTY_QUEUE_MESSAGE)
    }
  }

  return lines.slice(0, 2)
}

export function buildAvaDailyActivityNarrative(input: {
  memorySummary: AvaMemorySummary | null | undefined
  salesDailySummary?: SalesOutcomeDailySummary | null
  workResult: AvaWorkManagerResult
  operatingRhythm: AvaOperatingRhythm
  specialistOrchestrator?: AvaSpecialistOrchestratorResult | null
  hour: number
  repliesToday?: number
  setupIncomplete?: boolean
  setupBlockingSummary?: string | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): AvaDailyActivityNarrative {
  const completedLines = buildDailyActivityCompletedLines(input)
  const workingNowLines = buildDailyActivityWorkingNowLines(input)
  const waitingLines = buildDailyActivityWaitingLines(input)
  const learnedLines = buildDailyActivityLearnedLines(input.memorySummary)
  const workingNextLines = buildDailyActivityWorkingNextLines(input)

  const approvalCount =
    input.workResult.operator_queue.filter((row) => row.type === "approval").length ||
    input.salesDailySummary?.approvals_pending ||
    0
  const replyCount = input.workResult.operator_queue.filter((row) => row.type === "reply").length

  const discoveryFocus = resolveLeadDiscoveryNarrativeFocus(input.missionDiscovery)

  const focus = resolveNarrativeIntelligenceFocus({
    setupIncomplete: input.setupIncomplete,
    approvalCount,
    replyCount,
    activeWorkType: input.workResult.active_work?.type ?? null,
    researchedToday: input.salesDailySummary?.researched ?? 0,
    outreachPreparedToday: input.salesDailySummary?.outreach_prepared ?? 0,
    discoveryActive: discoveryFocus === "discovery",
  })

  const section_order = resolveNarrativeIntelligenceSectionOrder({
    completedCount: completedLines.length,
    workingNowCount: workingNowLines.length,
    waitingCount: waitingLines.length,
    learnedCount: learnedLines.length,
    workingNextCount: workingNextLines.length,
    approvalCount,
    replyCount,
    setupIncomplete: input.setupIncomplete,
    focus,
  })

  const lines: AvaDailyActivityLine[] = []

  for (const text of completedLines) pushLine(lines, "completed_today", text)
  for (const text of workingNowLines) pushLine(lines, "working_now", text)
  for (const text of waitingLines) pushLine(lines, "waiting_on_you", text)

  if (learnedLines.length > 0) {
    for (const text of learnedLines) pushLine(lines, "learned_today", text)
  } else if (!input.setupIncomplete) {
    pushLine(lines, "learned_today", NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE)
  }

  for (const text of workingNextLines) pushLine(lines, "working_next", text)

  if (waitingLines.length === 0 && !input.setupIncomplete && focus !== "discovery") {
    pushLine(lines, "waiting_on_you", buildNarrativeIntelligenceWaitingFallback())
  }

  const orderedLines = section_order.flatMap((section) => lines.filter((row) => row.section === section))

  const completed_today = lines.filter((row) => row.section === "completed_today").map((row) => row.text)
  const working_now = lines.filter((row) => row.section === "working_now").map((row) => row.text)
  const learned_today = lines.filter((row) => row.section === "learned_today").map((row) => row.text)
  const waiting_on_you = lines.filter((row) => row.section === "waiting_on_you").map((row) => row.text)
  const working_next = lines.filter((row) => row.section === "working_next").map((row) => row.text)

  return {
    qaMarker: GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
    lines: orderedLines,
    completed_today,
    working_now,
    learned_today,
    waiting_on_you,
    working_next,
    section_order,
    focus,
    summary: orderedLines.map((row) => row.text).join(" "),
  }
}

export function dailyActivityLinesToStoryBlocks(
  narrative: AvaDailyActivityNarrative,
): import("@/lib/growth/ava-home/narrative/narrative-types").AvaStoryBlock[] {
  const sectionPriority: Record<AvaDailyActivitySection, number> = {
    completed_today: 100,
    working_now: 95,
    waiting_on_you: 90,
    learned_today: 85,
    working_next: 80,
  }

  return narrative.lines.map((line, index) => ({
    id: `daily-activity:${line.section}:${index}`,
    kind:
      line.section === "waiting_on_you"
        ? "approval"
        : line.section === "working_next" || line.section === "working_now"
          ? "mission"
          : line.section === "learned_today"
            ? "general"
            : "accomplishment",
    priority: sectionPriority[line.section] - index,
    text: line.text,
    href: line.href ?? null,
  }))
}
