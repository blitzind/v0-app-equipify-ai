/** GE-AIOS-18E — Living Home presentation (Ava teammate voice, client-safe). */

import type { AvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/narrative-types"
import { extractFirstNameFromGreeting } from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { greetingForHour } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import {
  formatOperatorPackagesReadySummary,
  GROWTH_OPERATOR_PACKAGES_EMPTY_DETAIL,
  GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE,
} from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"

export const GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER =
  "ge-aios-18e-living-home-v1" as const

export const HOME_LIVING_EMPTY_WORK_MESSAGE =
  "I don't have companies in today's queue yet. Finish your Company Profile in Training and add leads — then I'll start researching and preparing outreach for your review." as const

export const HOME_LIVING_EMPTY_MEMORY_MESSAGE = GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE

export const HOME_LIVING_EMPTY_PROGRESS_MESSAGE =
  "I'm planning today's priorities as work comes in." as const

export const HOME_LIVING_WAITING_EMPTY_MESSAGE =
  `${GROWTH_OPERATOR_PACKAGES_EMPTY_TITLE} ${GROWTH_OPERATOR_PACKAGES_EMPTY_DETAIL}` as const

export const HOME_LIVING_ALL_CLEAR_WITH_NARRATIVE =
  "I'm keeping an eye on everything else in the background." as const

export const HOME_LIVING_GET_AVA_READY_TITLE = "Get me ready to work" as const

export const HOME_LIVING_GET_AVA_READY_DESCRIPTION =
  "I need a few things before I can research companies and prepare outreach for your review." as const

export const HOME_LIVING_GET_AVA_READY_COMPLETE_COPY =
  "I'm ready to work. I'll keep researching and preparing outreach while you review and approve from Home." as const

export const HOME_LIVING_DAILY_ACTIVITY_SECTION_LABELS = {
  completed_today: "What I accomplished",
  working_now: "What I'm working on",
  waiting_on_you: "What I need from you",
  learned_today: "What I've learned",
  working_next: "What's next",
} as const

export function resolveOperatorFirstName(input: {
  greeting?: string | null
  operatorDisplayName?: string | null
}): string | null {
  const fromGreeting = input.greeting ? extractFirstNameFromGreeting(input.greeting) : null
  if (fromGreeting) return fromGreeting
  const display = input.operatorDisplayName?.trim()
  if (!display) return null
  return display.split(/\s+/)[0] ?? null
}

export function buildPersonalizedHomeGreeting(input: {
  hour: number
  greeting?: string | null
  operatorDisplayName?: string | null
}): string {
  const firstName = resolveOperatorFirstName(input)
  const base = greetingForHour(input.hour)
  return firstName ? `${base}, ${firstName}.` : `${base}.`
}

export function buildLivingHomeOpeningLine(input: {
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  hasPrimaryDecision?: boolean
}): string | null {
  const narrative = input.dailyActivityNarrative
  if (narrative?.completed_today.length) {
    return "I've been working on today's plan."
  }
  if (narrative?.working_next.length || narrative?.waiting_on_you.length) {
    return "I've been preparing for today's work."
  }
  if (input.hasPrimaryDecision) {
    return null
  }
  return "I'm getting oriented for today's work."
}

export function formatLivingWaitingSummary(input: {
  approvalCount: number
  replyCount?: number
}): string {
  return formatOperatorPackagesReadySummary({
    packageCount: input.approvalCount,
    replyCount: input.replyCount,
  })
}

export function buildLivingSpecialistIdleLabel(input: {
  specialistId: string
  activeCount: number
  isStub: boolean
  hasApprovalWaiting?: boolean
  hasResearchWork?: boolean
}): string {
  if (input.isStub) {
    return "I'll join in when this capability is enabled."
  }
  if (input.activeCount > 0) {
    return ""
  }
  if (input.hasApprovalWaiting) {
    return "Ready for your review."
  }
  if (input.specialistId === "sales" && !input.hasResearchWork) {
    return "I'm still waiting for companies to research."
  }
  if (input.specialistId === "sales") {
    return "Ready when accounts enter today's queue."
  }
  return "No active work in my queue right now."
}
