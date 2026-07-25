/**
 * AVA-HOME-SIMPLIFICATION-1A — Executive Home surface (presentation-only).
 * Reorganizes existing Home projections; does not change business logic or data sources.
 */

import type { GrowthCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import {
  formatOperatorDailyBriefOpening,
  inferDailyBriefReviewCounts,
} from "@/lib/growth/aios/operator-experience/growth-operator-home-ava-direct-2a"
import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import type { GrowthHomeAvaRecommendationItem } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type {
  GrowthHomeCompletedTodayTimelineEntry,
  GrowthHomeMeasurableProgressItem,
  GrowthHomeWorkspaceHealthPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import type { AvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative"

export const GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER =
  "ava-home-simplification-1a-executive-surface-v1" as const

export const GROWTH_HOME_SIMPLIFICATION_DAILY_BRIEF_TITLE = "Daily Brief" as const
export const GROWTH_HOME_SIMPLIFICATION_CURRENT_FOCUS_TITLE = "Current Focus" as const
export const GROWTH_HOME_SIMPLIFICATION_PROGRESS_TITLE = "Progress" as const
export const GROWTH_HOME_SIMPLIFICATION_ACTIVITY_LOG_TITLE = "Activity Log" as const
export const GROWTH_HOME_SIMPLIFICATION_ACTIVITY_LOG_SUBTITLE =
  "Today's work, timeline, and research history." as const
export const GROWTH_HOME_SIMPLIFICATION_LEARNING_TITLE = "Learning" as const
export const GROWTH_HOME_SIMPLIFICATION_LEARNING_SUBTITLE =
  "Everything Ava has learned today." as const
export const GROWTH_HOME_SIMPLIFICATION_PIPELINE_HEALTH_TITLE = "Pipeline Health" as const
export const GROWTH_HOME_SIMPLIFICATION_PIPELINE_HEALTH_SUBTITLE =
  "Health, coverage, discovery, research, admissions, and goals." as const
export const GROWTH_HOME_SIMPLIFICATION_MISSION_TITLE = "Mission" as const
export const GROWTH_HOME_SIMPLIFICATION_ORG_MISSION_LABEL = "Acquire Equipify Customers" as const

export const GROWTH_HOME_SIMPLIFICATION_REVIEW_PACKAGE_CTA = "Review Package" as const
export const GROWTH_HOME_SIMPLIFICATION_ASK_WHY_CTA = "Ask Ava Why" as const
export const GROWTH_HOME_SIMPLIFICATION_SKIP_CTA = "Skip" as const
export const GROWTH_HOME_SIMPLIFICATION_SUGGEST_DIRECTION_CTA = "Suggest Different Direction" as const

export type GrowthHomeDailyBriefPresentation = {
  qaMarker: typeof GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER
  accomplishmentLine: string | null
  opportunityLine: string | null
  companyName: string | null
  fitBullets: string[]
  recommendationLine: string | null
  whatHappensNextLine: string | null
  primaryActionHref: string | null
  primaryActionLabel: string
}

export type GrowthHomeCurrentFocusPresentation = {
  qaMarker: typeof GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER
  companyName: string | null
  companyHref: string | null
  statusLabel: string
  nextActionLabel: string
  estimatedEffortLabel: string | null
  confidenceLabel: string | null
}

export type GrowthHomeMissionOpportunityPresentation = {
  qaMarker: typeof GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER
  missionLabel: string
  opportunityQueue: Array<{
    companyName: string
    href: string
    isCurrent: boolean
  }>
  overflowCount: number
}

export type GrowthHomeSimplifiedProgressCard = {
  id: string
  label: string
  value: string
}

function resolvePrimaryCompanyName(input: {
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
  recommendation: GrowthHomeAvaRecommendationItem | null
  waitingItem: GrowthHomeWaitingOnYouItem | null
}): string | null {
  return (
    input.recommendation?.companyName?.trim() ??
    input.runtimeTrust?.operatorFocusCompanyName?.trim() ??
    input.runtimeTrust?.currentLeadCompanyName?.trim() ??
    input.waitingItem?.label?.replace(/^Review\s+/i, "").trim() ??
    null
  )
}

function resolvePrimaryActionHref(input: {
  recommendation: GrowthHomeAvaRecommendationItem | null
  waitingItem: GrowthHomeWaitingOnYouItem | null
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
}): string | null {
  return (
    input.recommendation?.href ??
    input.waitingItem?.href ??
    input.runtimeTrust?.operatorFocusHref ??
    input.runtimeTrust?.startStatus.primaryActionHref ??
    null
  )
}

function resolveStatusLabel(input: {
  pendingApprovals: number
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
}): string {
  if (input.pendingApprovals > 0) return "Waiting for your approval"
  if (input.runtimeTrust?.operatorState === "working") return "Working in the background"
  if (input.runtimeTrust?.operatorState === "waiting") return "Waiting for your decision"
  if (input.runtimeTrust?.operatorState === "blocked") return "Blocked"
  return input.runtimeTrust?.operatorStateLabel ?? "Monitoring pipeline"
}

function resolveNextActionLabel(input: {
  pendingApprovals: number
  recommendation: GrowthHomeAvaRecommendationItem | null
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
}): string {
  if (input.pendingApprovals > 0) return "Review prepared outreach"
  if (input.recommendation?.outcomeProjection?.nextStepLabel) {
    return input.recommendation.outcomeProjection.nextStepLabel.replace(/\.$/, "")
  }
  if (input.runtimeTrust?.nextMilestoneLabel) {
    return input.runtimeTrust.nextMilestoneLabel.replace(/\.$/, "")
  }
  return "Continue pipeline work"
}

export function buildGrowthHomeDailyBriefPresentation(input: {
  pendingApprovals: number
  readyForOutreachReview?: number
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  completedTodayLines?: string[]
  recommendation: GrowthHomeAvaRecommendationItem | null
  waitingItem: GrowthHomeWaitingOnYouItem | null
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
  fitBullets?: string[]
}): GrowthHomeDailyBriefPresentation {
  const briefCounts = inferDailyBriefReviewCounts({
    pendingDraftCount: input.pendingApprovals,
    completedTodayLines: input.completedTodayLines ?? input.dailyActivityNarrative?.completed_today,
  })

  const accomplishmentLine = formatOperatorDailyBriefOpening({
    pendingDraftCount: input.pendingApprovals,
    companiesReviewedToday: briefCounts.companiesReviewedToday,
    strongOpportunities: briefCounts.strongOpportunities,
    notAFit: briefCounts.notAFit,
    needsInformation: briefCounts.needsInformation,
  })

  const companyName = resolvePrimaryCompanyName({
    runtimeTrust: input.runtimeTrust,
    recommendation: input.recommendation,
    waitingItem: input.waitingItem,
  })

  const strongCount = Math.max(briefCounts.strongOpportunities, input.pendingApprovals > 0 ? 1 : 0)
  const opportunityLine =
    strongCount > 0
      ? `I found ${strongCount} ${strongCount === 1 ? "opportunity I recommend pursuing" : "opportunities I recommend pursuing"}.`
      : null

  const recommendationLine =
    input.pendingApprovals > 0
      ? "Review the prepared outreach package."
      : input.recommendation?.employeeHeadline?.replace(/^My recommendation is to /i, "").replace(/^I recommend /i, "") ??
        input.recommendation?.headline?.replace(/^My recommendation is to /i, "").replace(/^I recommend /i, "") ??
        null

  const whatHappensNextLine = input.runtimeTrust?.whatHappensNextLines[0] ?? null

  return {
    qaMarker: GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
    accomplishmentLine,
    opportunityLine,
    companyName,
    fitBullets: (input.fitBullets ?? []).slice(0, 4),
    recommendationLine,
    whatHappensNextLine,
    primaryActionHref: resolvePrimaryActionHref({
      recommendation: input.recommendation,
      waitingItem: input.waitingItem,
      runtimeTrust: input.runtimeTrust,
    }),
    primaryActionLabel: GROWTH_HOME_SIMPLIFICATION_REVIEW_PACKAGE_CTA,
  }
}

export function buildGrowthHomeCurrentFocusPresentation(input: {
  pendingApprovals: number
  recommendation: GrowthHomeAvaRecommendationItem | null
  waitingItem: GrowthHomeWaitingOnYouItem | null
  runtimeTrust: GrowthHomeRuntimeTrustViewModel | null
}): GrowthHomeCurrentFocusPresentation | null {
  const companyName = resolvePrimaryCompanyName({
    runtimeTrust: input.runtimeTrust,
    recommendation: input.recommendation,
    waitingItem: input.waitingItem,
  })

  if (!companyName) return null

  const confidenceLabel =
    input.recommendation?.explanation?.confidenceLabel ??
    input.runtimeTrust?.operatorFocusConfidenceLine ??
    null

  const estimatedEffortLabel =
    input.recommendation?.explanation?.estimatedEffortLabel ??
    input.recommendation?.estimatedEffortLabel ??
    null

  return {
    qaMarker: GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
    companyName,
    companyHref:
      input.runtimeTrust?.operatorFocusHref ??
      (input.recommendation?.leadId
        ? `/growth/leads/crm?open=${input.recommendation.leadId}&focus=ai-copilot`
        : null),
    statusLabel: resolveStatusLabel({
      pendingApprovals: input.pendingApprovals,
      runtimeTrust: input.runtimeTrust,
    }),
    nextActionLabel: resolveNextActionLabel({
      pendingApprovals: input.pendingApprovals,
      recommendation: input.recommendation,
      runtimeTrust: input.runtimeTrust,
    }),
    estimatedEffortLabel,
    confidenceLabel,
  }
}

export function buildGrowthHomeMissionOpportunityPresentation(input: {
  missions: GrowthCanonicalMission[]
  overflowMissionCount?: number
  currentCompanyName?: string | null
}): GrowthHomeMissionOpportunityPresentation | null {
  if (input.missions.length === 0) return null

  const current = input.currentCompanyName?.trim().toLowerCase() ?? null

  return {
    qaMarker: GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
    missionLabel: GROWTH_HOME_SIMPLIFICATION_ORG_MISSION_LABEL,
    opportunityQueue: input.missions.map((mission) => ({
      companyName: mission.companyName,
      href: mission.workspaceHref,
      isCurrent: current ? mission.companyName.trim().toLowerCase() === current : false,
    })),
    overflowCount: Math.max(0, input.overflowMissionCount ?? 0),
  }
}

const PROGRESS_LABEL_ALIASES: Record<string, string> = {
  "companies-discovered": "Companies Reviewed",
  researched: "Companies Reviewed",
  "outreach-drafts-created": "Drafts Created",
  "drafts-awaiting-review": "Awaiting Review",
  "ready-for-outreach-review": "Drafts Created",
  qualified: "Companies Reviewed",
}

export function buildGrowthHomeSimplifiedProgressCards(input: {
  progressItems: GrowthHomeMeasurableProgressItem[]
  emailsSentToday?: number
  activeOutreachCount?: number
  pipelineHealthLabel?: string | null
}): GrowthHomeSimplifiedProgressCard[] {
  const cards: GrowthHomeSimplifiedProgressCard[] = []
  const seen = new Set<string>()

  for (const item of input.progressItems) {
    const label = PROGRESS_LABEL_ALIASES[item.id] ?? item.label
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({ id: item.id, label, value: item.value })
    if (cards.length >= 4) break
  }

  if ((input.emailsSentToday ?? 0) > 0 && !seen.has("sent today")) {
    cards.push({
      id: "sent-today",
      label: "Sent Today",
      value: String(input.emailsSentToday),
    })
    seen.add("sent today")
  }

  if ((input.activeOutreachCount ?? 0) > 0 && !seen.has("active outreach")) {
    cards.push({
      id: "active-outreach",
      label: "Active Outreach",
      value: String(input.activeOutreachCount),
    })
    seen.add("active outreach")
  }

  if (input.pipelineHealthLabel && !seen.has("pipeline progress")) {
    cards.push({
      id: "pipeline-progress",
      label: "Pipeline Progress",
      value: input.pipelineHealthLabel,
    })
  }

  return cards.slice(0, 6)
}

export function detectHomeCompanyNameRedundancy(input: {
  companyName: string | null
  sectionTexts: string[]
}): { redundant: boolean; matchCount: number } {
  const company = input.companyName?.trim().toLowerCase()
  if (!company) return { redundant: false, matchCount: 0 }

  let matchCount = 0
  for (const text of input.sectionTexts) {
    if (text.toLowerCase().includes(company)) matchCount += 1
  }

  return { redundant: matchCount > 2, matchCount }
}

export function collectHomeSimplificationSectionTexts(input: {
  dailyBrief: GrowthHomeDailyBriefPresentation | null
  currentFocus: GrowthHomeCurrentFocusPresentation | null
  recommendationHeadline: string | null
  waitingLabels: string[]
  runtimeTrustLabels: string[]
  missionTitles: string[]
}): string[] {
  const texts: string[] = []
  if (input.dailyBrief?.companyName) texts.push(input.dailyBrief.companyName)
  if (input.dailyBrief?.recommendationLine) texts.push(input.dailyBrief.recommendationLine)
  if (input.currentFocus?.companyName) texts.push(input.currentFocus.companyName)
  if (input.recommendationHeadline) texts.push(input.recommendationHeadline)
  texts.push(...input.waitingLabels, ...input.runtimeTrustLabels, ...input.missionTitles)
  return texts
}

export function mergeActivityLogEntries(input: {
  completedToday: GrowthHomeCompletedTodayTimelineEntry[]
  activityFeedSummaries: string[]
}): GrowthHomeCompletedTodayTimelineEntry[] {
  const entries = [...input.completedToday]
  const seen = new Set(entries.map((entry) => entry.summary.toLowerCase()))

  for (const summary of input.activityFeedSummaries) {
    const key = summary.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      id: `feed:${summary}`,
      timeLabel: "Today",
      summary,
    })
  }

  return entries.slice(0, 12)
}

export function buildPipelineHealthCollapsibleItems(
  presentation: GrowthHomeWorkspaceHealthPresentation | null,
): Array<{ id: string; label: string; value: string }> {
  return (presentation?.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
  }))
}
