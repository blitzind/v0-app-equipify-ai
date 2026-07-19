/** GE-AIOS-18F — Narrative Intelligence (context-aware daily briefing presentation, client-safe). */

import type { AvaDailyActivitySection, NarrativeIntelligenceFocus } from "@/lib/growth/ava-home/narrative/narrative-types"
import { GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import { HOME_LIVING_WAITING_EMPTY_MESSAGE } from "@/lib/growth/home/growth-home-living-experience-18e"
import {
  formatOperatorHomeOpeningWithPackages,
} from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"

export const GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER =
  "ge-aios-18f-narrative-intelligence-v1" as const

export const NARRATIVE_INTELLIGENCE_SECTION_LABELS: Record<AvaDailyActivitySection, string> = {
  completed_today: "What I accomplished",
  working_now: "What I'm working on",
  waiting_on_you: "What I need from you",
  learned_today: "What I've learned",
  working_next: "What's next",
}

export const NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE = GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE

export const NARRATIVE_INTELLIGENCE_SETUP_INCOMPLETE_MESSAGE =
  "I still need a few setup steps before I can begin researching companies and preparing outreach." as const

export const NARRATIVE_INTELLIGENCE_EMPTY_QUEUE_MESSAGE =
  "I don't have accounts in today's queue yet — I'll start as soon as companies are ready to research." as const

export type ResolveNarrativeSectionOrderInput = {
  completedCount: number
  workingNowCount: number
  waitingCount: number
  learnedCount: number
  workingNextCount: number
  approvalCount: number
  replyCount: number
  setupIncomplete?: boolean
  focus: NarrativeIntelligenceFocus
}

const DEFAULT_SECTION_ORDER: AvaDailyActivitySection[] = [
  "completed_today",
  "working_now",
  "waiting_on_you",
  "learned_today",
  "working_next",
]

/** Context-aware section ordering — approvals top billing when blocking. */
export function resolveNarrativeIntelligenceSectionOrder(
  input: ResolveNarrativeSectionOrderInput,
): AvaDailyActivitySection[] {
  const sections = new Set<AvaDailyActivitySection>()

  if (input.setupIncomplete) {
    return ["working_next", "waiting_on_you", "completed_today", "working_now", "learned_today"]
  }

  if (input.focus === "approvals" || (input.approvalCount >= 2 && input.waitingCount > 0)) {
    return ["waiting_on_you", "completed_today", "working_now", "learned_today", "working_next"]
  }

  if (input.focus === "follow_up" || input.replyCount > 0) {
    return ["waiting_on_you", "working_now", "completed_today", "learned_today", "working_next"]
  }

  if (input.focus === "outreach") {
    return ["completed_today", "working_now", "waiting_on_you", "learned_today", "working_next"]
  }

  if (input.focus === "research" && input.completedCount > 0) {
    return ["completed_today", "working_now", "waiting_on_you", "learned_today", "working_next"]
  }

  if (input.focus === "discovery") {
    return ["working_now", "working_next", "completed_today", "waiting_on_you", "learned_today"]
  }

  return DEFAULT_SECTION_ORDER.filter((section) => {
    if (sections.has(section)) return false
    sections.add(section)
    return true
  })
}

export function resolveNarrativeIntelligenceFocus(input: {
  setupIncomplete?: boolean
  approvalCount: number
  replyCount: number
  activeWorkType?: string | null
  researchedToday?: number
  outreachPreparedToday?: number
  discoveryActive?: boolean
}): NarrativeIntelligenceFocus {
  if (input.setupIncomplete) return "setup"
  if (input.approvalCount > 0) return "approvals"
  if (input.replyCount > 0 || input.activeWorkType === "reply") return "follow_up"
  if (input.activeWorkType === "outreach" || (input.outreachPreparedToday ?? 0) > 0) return "outreach"
  if (input.activeWorkType === "research" || (input.researchedToday ?? 0) > 0) return "research"
  if (input.discoveryActive) return "discovery"
  return "idle"
}

export function buildNarrativeIntelligenceOpeningLine(input: {
  focus: NarrativeIntelligenceFocus
  hasPrimaryDecision?: boolean
  completedCount?: number
  waitingCount?: number
  packageCount?: number
  setupIncomplete?: boolean
  discoveryTarget?: string | null
}): string {
  if (input.setupIncomplete) {
    return "I'm ready to start — I just need a few things from you first."
  }
  const packages = Math.max(input.packageCount ?? input.waitingCount ?? 0, 0)
  const packageOpening = formatOperatorHomeOpeningWithPackages(packages)
  if (packageOpening) return packageOpening
  if (input.focus === "discovery") {
    if (input.discoveryTarget?.trim()) {
      return `I'm building your pipeline — finding ${input.discoveryTarget.trim()} that match your profile.`
    }
    return "I'm building your pipeline — finding companies that match your profile."
  }
  if (input.focus === "follow_up") {
    return "I've been following up on conversations that need attention."
  }
  if (input.focus === "outreach") {
    return "I've been preparing outreach for your review."
  }
  if ((input.completedCount ?? 0) > 0) {
    return "I've been working on today's plan."
  }
  if ((input.waitingCount ?? 0) > 0) {
    return "I've been preparing for today's work."
  }
  return "I'm getting oriented for today's work."
}

export function buildNarrativeIntelligenceWaitingFallback(): string {
  return HOME_LIVING_WAITING_EMPTY_MESSAGE
}
