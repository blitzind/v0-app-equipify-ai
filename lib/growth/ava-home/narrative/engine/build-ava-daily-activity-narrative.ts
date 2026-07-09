/** GE-AIOS-17D — Ava Daily Activity Narrative (Memory → Knowledge → Work Manager → Rhythm). */

import type {
  AvaDailyActivityLine,
  AvaDailyActivityNarrative,
  AvaDailyActivitySection,
} from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaMemorySummary } from "@/lib/growth/memory/types"
import { buildKnowledgeNarrativeLines } from "@/lib/growth/memory/knowledge/build-organizational-knowledge"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { buildPhaseAwareNarrativeLine } from "@/lib/growth/operating-rhythm/bridges/narrative-bridge"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { HOME_RUNTIME_EMPTY_WORK_MESSAGE } from "@/lib/growth/home/growth-home-runtime-presenter"

export const GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER =
  "ge-aios-17d-daily-activity-narrative-v1" as const

export const AVA_DAILY_ACTIVITY_SECTION_LABELS: Record<
  AvaDailyActivitySection,
  string
> = {
  completed_today: "Completed today",
  learned_today: "Learned today",
  waiting_on_you: "Waiting on you",
  working_next: "Working next",
}

export const AVA_DAILY_ACTIVITY_SECTION_ORDER: AvaDailyActivitySection[] = [
  "completed_today",
  "learned_today",
  "waiting_on_you",
  "working_next",
]

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

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

/** Completed work — Memory / validated sales outcomes only (no invented activity). */
export function buildDailyActivityCompletedLines(input: {
  memorySummary: AvaMemorySummary | null | undefined
  salesDailySummary?: SalesOutcomeDailySummary | null
}): string[] {
  const dailySummary = input.salesDailySummary
  if (dailySummary) {
    const lines: string[] = []
    if (dailySummary.researched > 0 && dailySummary.strong_opportunities > 0) {
      lines.push(
        `Today I researched ${dailySummary.researched} ${pluralize(dailySummary.researched, "company", "companies")} and identified ${dailySummary.strong_opportunities} strong ${pluralize(dailySummary.strong_opportunities, "opportunity", "opportunities")}.`,
      )
    } else if (dailySummary.researched > 0) {
      lines.push(
        `Today I researched ${dailySummary.researched} ${pluralize(dailySummary.researched, "company", "companies")}.`,
      )
    } else if (dailySummary.strong_opportunities > 0) {
      lines.push(
        `I identified ${dailySummary.strong_opportunities} strong ${pluralize(dailySummary.strong_opportunities, "opportunity", "opportunities")}.`,
      )
    }

    if (dailySummary.qualified > 0 && dailySummary.researched === 0) {
      lines.push(`I qualified ${dailySummary.qualified} ${pluralize(dailySummary.qualified, "opportunity", "opportunities")}.`)
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

    if (lines.length > 0) return lines
  }

  const salesEvents = (input.memorySummary?.recent_events ?? []).filter(
    (row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE,
  )
  if (salesEvents.length === 0) return []

  const researched = salesEvents.filter((row) => row.metadata.outcome_type === "research_completed").length
  const qualified = salesEvents.filter((row) => row.metadata.outcome_type === "qualification_completed").length
  const outreachPrepared = salesEvents.filter((row) => row.metadata.outcome_type === "outreach_prepared").length
  const meetingsPrepared = salesEvents.filter((row) => row.metadata.outcome_type === "meeting_prepared").length

  const lines: string[] = []
  if (researched > 0 && qualified > 0) {
    lines.push(
      `Today I researched ${researched} ${pluralize(researched, "company", "companies")} and qualified ${qualified} ${pluralize(qualified, "opportunity", "opportunities")}.`,
    )
  } else if (researched > 0) {
    lines.push(`Today I researched ${researched} ${pluralize(researched, "company", "companies")}.`)
  } else if (qualified > 0) {
    lines.push(`I qualified ${qualified} ${pluralize(qualified, "opportunity", "opportunities")}.`)
  }

  if (outreachPrepared > 0) {
    lines.push(`I prepared ${outreachPrepared} outreach ${pluralize(outreachPrepared, "draft", "drafts")}.`)
  }
  if (meetingsPrepared > 0) {
    lines.push(`I prepared ${meetingsPrepared} meeting ${pluralize(meetingsPrepared, "brief", "briefs")}.`)
  }

  return lines.slice(0, 3)
}

/** Learned insights — Organizational Knowledge only. */
export function buildDailyActivityLearnedLines(
  memorySummary: AvaMemorySummary | null | undefined,
): string[] {
  return buildKnowledgeNarrativeLines(memorySummary?.organizational_knowledge ?? []).slice(0, 2)
}

/** Waiting on operator — Work Manager / Decision queue only. */
export function buildDailyActivityWaitingLines(input: {
  workResult: AvaWorkManagerResult
  salesDailySummary?: SalesOutcomeDailySummary | null
}): string[] {
  const lines: string[] = []
  const approvalItems = input.workResult.operator_queue.filter((row) => row.type === "approval")
  const approvalCount = approvalItems.length || input.salesDailySummary?.approvals_pending || 0

  if (approvalCount > 0) {
    lines.push(
      `${approvalCount} outreach ${pluralize(approvalCount, "draft is", "drafts are")} waiting for your approval.`,
    )
  }

  const replyItems = input.workResult.operator_queue.filter((row) => row.type === "reply")
  if (replyItems.length > 0 && lines.length < 2) {
    lines.push(
      `${replyItems.length} ${pluralize(replyItems.length, "reply needs", "replies need")} your review.`,
    )
  }

  const otherWaiting = input.workResult.operator_queue.filter(
    (row) => row.type !== "approval" && row.type !== "reply",
  )
  if (otherWaiting.length > 0 && lines.length === 0) {
    lines.push(
      `${otherWaiting.length} ${pluralize(otherWaiting.length, "item is", "items are")} waiting for your decision.`,
    )
  }

  return lines.slice(0, 2)
}

/** Working next — Work Manager plan + Operating Rhythm framing (no invented tasks). */
export function buildDailyActivityWorkingNextLines(input: {
  workResult: AvaWorkManagerResult
  operatingRhythm: AvaOperatingRhythm
  hour: number
}): string[] {
  const lines: string[] = []
  const readyPlan = input.workResult.work_plan.filter((row) => row.status === "ready")
  const activeWork = input.workResult.active_work

  if (activeWork && activeWork.status === "working") {
    const title = activeWork.title.trim().replace(/\.$/, "")
    lines.push(`Next, I'm ${title.charAt(0).toLowerCase()}${title.slice(1)}.`)
  } else if (readyPlan.length > 0) {
    const top = readyPlan[0]
    const company = top.title.replace(/^(Research company|Prepare outreach|Continue qualification)\s+—\s+/i, "").trim()
    if (company && company !== top.title) {
      lines.push(`Next, I'll continue with ${company}.`)
    } else if (readyPlan.length === 1) {
      lines.push(`Next, I'll ${top.title.charAt(0).toLowerCase()}${top.title.slice(1).replace(/\.$/, "")}.`)
    } else {
      lines.push(
        `Next, I'll continue working through ${readyPlan.length} remaining ${pluralize(readyPlan.length, "account", "accounts")} in today's plan.`,
      )
    }
  }

  if (lines.length === 0 && input.workResult.work_plan.length > 0) {
    const phaseLine = buildPhaseAwareNarrativeLine(input.operatingRhythm, input.hour)
    if (phaseLine && !/continuing through today's operating plan/i.test(phaseLine)) {
      lines.push(phaseLine.endsWith(".") ? phaseLine : `${phaseLine}.`)
    }
  }

  return lines.slice(0, 2)
}

export function buildAvaDailyActivityNarrative(input: {
  memorySummary: AvaMemorySummary | null | undefined
  salesDailySummary?: SalesOutcomeDailySummary | null
  workResult: AvaWorkManagerResult
  operatingRhythm: AvaOperatingRhythm
  hour: number
}): AvaDailyActivityNarrative {
  const lines: AvaDailyActivityLine[] = []

  for (const text of buildDailyActivityCompletedLines(input)) {
    pushLine(lines, "completed_today", text)
  }
  for (const text of buildDailyActivityLearnedLines(input.memorySummary)) {
    pushLine(lines, "learned_today", text)
  }
  for (const text of buildDailyActivityWaitingLines(input)) {
    pushLine(lines, "waiting_on_you", text)
  }
  for (const text of buildDailyActivityWorkingNextLines(input)) {
    pushLine(lines, "working_next", text)
  }

  if (lines.length === 0) {
    pushLine(lines, "working_next", HOME_RUNTIME_EMPTY_WORK_MESSAGE)
  }

  const completed_today = lines.filter((row) => row.section === "completed_today").map((row) => row.text)
  const learned_today = lines.filter((row) => row.section === "learned_today").map((row) => row.text)
  const waiting_on_you = lines.filter((row) => row.section === "waiting_on_you").map((row) => row.text)
  const working_next = lines.filter((row) => row.section === "working_next").map((row) => row.text)

  return {
    qaMarker: GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
    lines,
    completed_today,
    learned_today,
    waiting_on_you,
    working_next,
    summary: lines.map((row) => row.text).join(" "),
  }
}

export function dailyActivityLinesToStoryBlocks(
  narrative: AvaDailyActivityNarrative,
): import("@/lib/growth/ava-home/narrative/narrative-types").AvaStoryBlock[] {
  const sectionPriority: Record<AvaDailyActivitySection, number> = {
    completed_today: 100,
    learned_today: 90,
    waiting_on_you: 80,
    working_next: 70,
  }

  return narrative.lines.map((line, index) => ({
    id: `daily-activity:${line.section}:${index}`,
    kind:
      line.section === "waiting_on_you"
        ? "approval"
        : line.section === "working_next"
          ? "mission"
          : line.section === "learned_today"
            ? "general"
            : "accomplishment",
    priority: sectionPriority[line.section] - index,
    text: line.text,
    href: line.href ?? null,
  }))
}
