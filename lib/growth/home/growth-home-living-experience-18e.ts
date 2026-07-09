/** GE-AIOS-18E — Living Home presentation (Ava teammate voice, client-safe). */

import type { AvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/narrative-types"
import { extractFirstNameFromGreeting } from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { greetingForHour } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"

export const GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER =
  "ge-aios-18e-living-home-v1" as const

export const HOME_LIVING_EMPTY_WORK_MESSAGE =
  "I don't have companies in today's queue yet. Finish your Company Profile in Training and add leads — then I'll start researching and preparing outreach for your review." as const

export const HOME_LIVING_EMPTY_MEMORY_MESSAGE =
  "I haven't earned validated learnings yet. As I research accounts and you approve outreach, patterns will appear here and in Training." as const

export const HOME_LIVING_EMPTY_PROGRESS_MESSAGE =
  "I'm planning today's priorities as work comes in." as const

export const HOME_LIVING_WAITING_EMPTY_MESSAGE =
  "Nothing needs your approval right now — I'll keep working and add drafts to Approvals when they're ready." as const

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
    return "I need your help on one thing before I can keep going."
  }
  return "I'm getting oriented for today's work."
}

export function formatLivingWaitingSummary(input: {
  approvalCount: number
  replyCount?: number
}): string {
  const approvals = Math.max(input.approvalCount, 0)
  const replies = Math.max(input.replyCount ?? 0, 0)
  if (approvals > 0 && replies > 0) {
    return `I've prepared ${approvals} outreach ${approvals === 1 ? "draft" : "drafts"} for your approval, and ${replies} ${replies === 1 ? "reply needs" : "replies need"} your review.`
  }
  if (approvals > 0) {
    return `I've prepared ${approvals} outreach ${approvals === 1 ? "draft" : "drafts"} that need your approval.`
  }
  if (replies > 0) {
    return `${replies} ${replies === 1 ? "reply needs" : "replies need"} your review before I can continue.`
  }
  return HOME_LIVING_WAITING_EMPTY_MESSAGE
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
    return "Waiting for your approval before I send outreach."
  }
  if (input.specialistId === "sales" && !input.hasResearchWork) {
    return "I'm still waiting for companies to research."
  }
  if (input.specialistId === "sales") {
    return "Ready when accounts enter today's queue."
  }
  return "No active work in my queue right now."
}
