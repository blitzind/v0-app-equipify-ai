/**
 * GE-AIOS-LIVE-3B / LIVE-3C — Home operator experience presentation (no new projections).
 */

import type { GrowthCanonicalOperatorProgressProjection } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeRuntimeTrustPipelineStep } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { SalesOutcome, SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { buildNarrativeIntelligenceOpeningLine } from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import {
  buildLeadDiscoveryWorkingNextLine,
  buildLeadDiscoveryWorkingNowLine,
} from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"

export const GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER =
  "ge-aios-live-3b-home-operator-experience-v1" as const

export const GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER =
  "ge-aios-live-3c-human-centered-home-language-v1" as const

export const GROWTH_HOME_SECTION_HERO_TITLE = "Current Work" as const
export const GROWTH_HOME_SECTION_OBJECTIVE_TITLE = "Why I'm Doing This" as const
export const GROWTH_HOME_SECTION_WORKING_NOW_TITLE = "What I'm Working On" as const
export const GROWTH_HOME_SECTION_PROGRESS_TITLE = "What I've Accomplished" as const
export const GROWTH_HOME_SECTION_RECOMMENDATION_TITLE = "What I Recommend" as const
export const GROWTH_HOME_SECTION_PORTFOLIO_TITLE = "Sales Pipeline" as const
export const GROWTH_HOME_SECTION_COMPLETED_TODAY_TITLE = "What I've Completed Today" as const
export const GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE = "Business Snapshot" as const

export const GROWTH_HOME_SECTION_OBJECTIVE_SUBTITLE =
  "The business outcome this work is serving" as const
export const GROWTH_HOME_SECTION_WORKING_NOW_SUBTITLE =
  "The exact task running right now" as const
export const GROWTH_HOME_SECTION_PROGRESS_SUBTITLE =
  "Measurable progress from today's work" as const
export const GROWTH_HOME_SECTION_RECOMMENDATION_SUBTITLE =
  "The decision I'd like your help with" as const
export const GROWTH_HOME_SECTION_PORTFOLIO_SUBTITLE =
  "How healthy your sales pipeline is" as const
export const GROWTH_HOME_SECTION_COMPLETED_TODAY_SUBTITLE =
  "Work finished today, in order" as const
export const GROWTH_HOME_SECTION_WORKSPACE_HEALTH_SUBTITLE =
  "Current operating scale across your business" as const

export type GrowthHomeHeroExecutiveBriefing = {
  qaMarker: typeof GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER
  paragraphs: string[]
  narrative: string
}

const INTERNAL_OPERATOR_TERMS =
  /missiondiscovery|lifecycle state|operator projection|startup discovery|provider eligible|canonical objective|queue state|run prospect search|readyforoutreachreview|finding_leads|preparing_recommendations|datamoon|audience execution/gi

function packageReviewPhrase(count: number): string {
  if (count <= 0) return ""
  if (count === 1) return "I have one outreach package ready for your review"
  return `I have ${count} outreach packages ready for your review`
}

export function humanizeOperatorFacingCopy(text: string | null | undefined): string {
  if (!text?.trim()) return ""
  let copy = text.trim()
  copy = copy.replace(/^Run Prospect Search\s*[—-]\s*/i, "Searching for companies that match ")
  copy = copy.replace(/^Run Prospect Search$/i, "Searching for matching companies")
  copy = copy.replace(/Equipify supported service verticals audience/gi, "your Growth Profile")
  copy = copy.replace(/\bGrowth Profile\b/gi, "your Growth Profile")
  copy = copy.replace(/\byour your Growth Profile\b/gi, "your Growth Profile")
  copy = copy.replace(/\bmission discovery\b/gi, "company search")
  copy = copy.replace(/\blifecycle state\b/gi, "current work")
  copy = copy.replace(/\bdatamoon\b/gi, "company search")
  copy = copy.replace(INTERNAL_OPERATOR_TERMS, "")
  copy = copy.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim()
  return copy
}

function discoveryActive(input: {
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
}): boolean {
  if (input.dailyActivityNarrative?.focus === "discovery") return true
  if (!input.missionDiscovery?.missionId) return false
  return (
    input.missionDiscovery.lifecycleState === "finding_leads" ||
    input.missionDiscovery.discoveryAction === "run_prospect_search" ||
    input.missionDiscovery.discoveryAction === "refresh_audience" ||
    input.missionDiscovery.startupDiscoveryReady === true
  )
}

export function buildHeroExecutiveBriefing(input: {
  statusLabel: string
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  pendingApprovals?: number
  readyForOutreachReview?: number
  discoveryTarget?: string | null
}): GrowthHomeHeroExecutiveBriefing {
  /** Canonical approval queue — sole authority for "ready for your review" language. */
  const pendingPackages = Math.max(0, input.pendingApprovals ?? 0)
  /** Research loop in-progress count — not the same as operator review queue. */
  const preparingOutreach = Math.max(0, input.readyForOutreachReview ?? 0)
  const setupIncomplete = input.dailyActivityNarrative?.focus === "setup"
  const paragraphs: string[] = []

  if (setupIncomplete) {
    paragraphs.push(
      "I'm ready to start — I just need a few setup steps from you before I can begin finding and researching companies.",
    )
    return {
      qaMarker: GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
      paragraphs,
      narrative: paragraphs.join(" "),
    }
  }

  if (discoveryActive(input)) {
    const lead =
      pendingPackages > 0 || preparingOutreach > 0
        ? "I'm actively searching for companies that match your Growth Profile"
        : "I'm searching for companies that match your Growth Profile"
    if (pendingPackages > 0) {
      paragraphs.push(
        `${lead}. ${packageReviewPhrase(pendingPackages)}, and after that I'll continue building the rest of your pipeline.`,
      )
    } else if (preparingOutreach > 0) {
      paragraphs.push(
        `${lead}. I'm preparing ${preparingOutreach === 1 ? "one outreach package" : `${preparingOutreach} outreach packages`} and will send ${preparingOutreach === 1 ? "it" : "them"} for your review when ready.`,
      )
    } else {
      paragraphs.push(
        `${lead} and will begin researching the strongest matches as they enter the pipeline.`,
      )
    }
  } else if (pendingPackages > 0) {
    paragraphs.push(
      `${packageReviewPhrase(pendingPackages)}, and after that I'll continue with the next highest-value work in your pipeline.`,
    )
  } else if (preparingOutreach > 0) {
    paragraphs.push(
      preparingOutreach === 1
        ? "I'm finishing an outreach package and will send it for your review shortly."
        : `I'm finishing ${preparingOutreach} outreach packages and will send them for your review shortly.`,
    )
  } else if (input.statusLabel === "Researching companies") {
    paragraphs.push(
      "I'm researching the strongest companies in your pipeline and preparing the next opportunities for your review.",
    )
  } else if (input.statusLabel === "Preparing outreach") {
    paragraphs.push(
      "I'm preparing outreach packages for your review before moving on to the next accounts in your pipeline.",
    )
  } else if (input.statusLabel === "Finding Leads") {
    paragraphs.push(
      "I'm searching for companies that match your Growth Profile and will begin researching the strongest matches as they enter the pipeline.",
    )
  } else if (input.statusLabel && input.statusLabel !== "Idle") {
    paragraphs.push(
      `I'm ${input.statusLabel.charAt(0).toLowerCase()}${input.statusLabel.slice(1)} and keeping today's pipeline moving.`,
    )
  } else {
    const fallback = buildNarrativeIntelligenceOpeningLine({
      focus: input.dailyActivityNarrative?.focus ?? "idle",
      packageCount: pendingPackages,
      waitingCount: input.dailyActivityNarrative?.waiting_on_you.length ?? 0,
      completedCount: input.dailyActivityNarrative?.completed_today.length ?? 0,
      setupIncomplete: false,
      discoveryTarget: input.discoveryTarget ?? input.missionDiscovery?.audienceName ?? null,
    })
    paragraphs.push(humanizeOperatorFacingCopy(fallback) || "I'm keeping an eye on your pipeline and will pick up the next step shortly.")
  }

  const sanitized = paragraphs
    .map((paragraph) => humanizeOperatorFacingCopy(paragraph))
    .filter(Boolean)
    .slice(0, 2)

  return {
    qaMarker: GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
    paragraphs: sanitized,
    narrative: sanitized.join(" "),
  }
}

export type GrowthHomeWorkingNowPresentation = {
  qaMarker: typeof GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER
  activeTask: string | null
  currentPhase: string | null
  nextStep: string | null
  blockers: string[]
  /** GE-AIOS-LAUNCH-1B — real runtime detail from work manager */
  companyName?: string | null
  startedLabel?: string | null
  expectedCompletionLabel?: string | null
  pipelineSteps?: GrowthHomeRuntimeTrustPipelineStep[]
}

export type GrowthHomeMeasurableProgressItem = {
  id: string
  label: string
  value: string
}

export type GrowthHomeMeasurableProgressPresentation = {
  qaMarker: typeof GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER
  title: string
  subtitle: string
  items: GrowthHomeMeasurableProgressItem[]
}

export type GrowthHomeCompletedTodayTimelineEntry = {
  id: string
  timeLabel: string
  summary: string
}

export type GrowthHomeWorkspaceHealthPresentation = {
  qaMarker: typeof GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER
  items: Array<{ id: string; label: string; value: string; tone?: "healthy" | "attention" | "neutral" }>
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Today"
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function outcomeTimelineSummary(outcome: SalesOutcome): string {
  const company = humanizeOperatorFacingCopy(outcome.summary.trim())
  switch (outcome.outcome_type) {
    case "research_completed":
      return company || "Completed research"
    case "qualification_completed":
      return company || "Qualified a company"
    case "outreach_prepared":
      return company || "Prepared an outreach package"
    case "meeting_prepared":
      return company || "Prepared a meeting"
    case "approval_pending":
      return company || "Prepared an outreach package for your review"
    default:
      return company || "Completed work"
  }
}

export function buildHeroCurrentWorkNarrative(input: {
  statusLabel: string
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  pendingApprovals?: number
  readyForOutreachReview?: number
  discoveryTarget?: string | null
}): string {
  return buildHeroExecutiveBriefing(input).narrative
}

export function buildHomeWorkingNowPresentation(input: {
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  workManager?: AvaWorkManagerResult | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  statusLabel?: string | null
  runtimeCurrentActivity?: {
    companyName?: string | null
    taskLabel?: string | null
    startedLabel?: string | null
    expectedCompletionLabel?: string | null
    pipelineSteps?: GrowthHomeRuntimeTrustPipelineStep[]
  } | null
}): GrowthHomeWorkingNowPresentation {
  const activeWork = input.workManager?.active_work ?? null
  const runtime = input.runtimeCurrentActivity
  const activeTask = humanizeOperatorFacingCopy(
    runtime?.taskLabel ??
      (activeWork ? describeWorkItemTask(activeWork) : null) ??
      input.dailyActivityNarrative?.working_now[0]?.replace(/\.$/, "") ??
      buildLeadDiscoveryWorkingNowLine(input.missionDiscovery)?.replace(/\.$/, "") ??
      null,
  )

  const nextStep = humanizeOperatorFacingCopy(
    input.dailyActivityNarrative?.working_next[0]?.replace(/\.$/, "") ??
      buildLeadDiscoveryWorkingNextLine(input.missionDiscovery)?.replace(/\.$/, "") ??
      null,
  )

  const currentPhase = humanizeOperatorFacingCopy(
    input.missionDiscovery?.activityLabel ??
      input.statusLabel ??
      activeWork?.relationship_stage ??
      null,
  )

  const blockers = (input.workManager?.blocked ?? [])
    .slice(0, 3)
    .map((item) => item.blocked_reason?.trim() || item.title)
    .filter(Boolean)

  return {
    qaMarker: GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
    activeTask,
    currentPhase,
    nextStep,
    blockers,
    companyName: runtime?.companyName ?? activeWork?.company_name?.trim() ?? null,
    startedLabel: runtime?.startedLabel ?? null,
    expectedCompletionLabel: runtime?.expectedCompletionLabel ?? null,
    pipelineSteps: runtime?.pipelineSteps,
  }
}

function describeWorkItemTask(item: AvaWorkItem): string {
  const company = item.company_name?.trim()
  if (item.type === "research" && company) return `Researching ${company}`
  if (item.type === "outreach" && company) return `Preparing an outreach package for ${company}`
  if (item.type === "reply" && company) return `Following up with ${company}`
  if (item.type === "qualification" && company) return `Qualifying ${company}`
  return humanizeOperatorFacingCopy(item.title.replace(/\.$/, ""))
}

export function buildHomeMeasurableProgressPresentation(input: {
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  portfolio?: GrowthPortfolioManagerOperatorProjection | null
  dailySummary?: SalesOutcomeDailySummary | null
  pendingApprovals?: number
  readyForOutreachReview?: number
}): GrowthHomeMeasurableProgressPresentation {
  const items: GrowthHomeMeasurableProgressItem[] = []
  const mission = input.missionDiscovery

  if (mission?.newCompaniesFound != null && mission.newCompaniesFound > 0) {
    items.push({
      id: "companies-discovered",
      label: "Companies discovered",
      value: String(mission.newCompaniesFound),
    })
  }
  if (mission?.recordsImported != null && mission.recordsImported > 0) {
    items.push({
      id: "companies-imported",
      label: "Companies imported",
      value: String(mission.recordsImported),
    })
  }

  const summary = input.dailySummary
  if (summary?.researched != null && summary.researched > 0) {
    items.push({ id: "researched", label: "Researched today", value: String(summary.researched) })
  }
  if (summary?.qualified != null && summary.qualified > 0) {
    items.push({ id: "qualified", label: "Qualified today", value: String(summary.qualified) })
  }
  if ((summary?.outreach_prepared ?? 0) > 0) {
    items.push({
      id: "packages-prepared",
      label: "Packages prepared",
      value: String(summary!.outreach_prepared),
    })
  }

  if ((input.pendingApprovals ?? 0) > 0) {
    items.push({
      id: "packages-awaiting-review",
      label: "Packages awaiting your review",
      value: String(input.pendingApprovals),
    })
  }

  if (input.portfolio) {
    items.push({
      id: "portfolio-active",
      label: "Active companies",
      value: `${input.portfolio.currentActiveCompanies} / ${input.portfolio.targetActiveCompanies}`,
    })
  } else if (mission && input.missionDiscovery) {
    const goal = input.missionDiscovery.leadPoolVisible
    if (goal != null && goal >= 0) {
      items.push({
        id: "lead-pool-visible",
        label: "Visible in pipeline",
        value: String(goal),
      })
    }
  }

  return {
    qaMarker: GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
    title: GROWTH_HOME_SECTION_PROGRESS_TITLE,
    subtitle: GROWTH_HOME_SECTION_PROGRESS_SUBTITLE,
    items,
  }
}

export function buildHomeCompletedTodayTimeline(input: {
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  workManager?: AvaWorkManagerResult | null
  salesOutcomes?: SalesOutcome[] | null
  generatedAt?: string | null
}): GrowthHomeCompletedTodayTimelineEntry[] {
  const entries: GrowthHomeCompletedTodayTimelineEntry[] = []

  for (const outcome of (input.salesOutcomes ?? []).slice(0, 8)) {
    entries.push({
      id: `outcome:${outcome.work_item_id ?? outcome.completed_at}:${outcome.outcome_type}`,
      timeLabel: formatTimeLabel(outcome.completed_at),
      summary: outcomeTimelineSummary(outcome),
    })
  }

  for (const line of input.dailyActivityNarrative?.completed_today ?? []) {
    entries.push({
      id: `narrative:${line}`,
      timeLabel: "Today",
      summary: humanizeOperatorFacingCopy(line.replace(/\.$/, "")),
    })
  }

  for (const item of input.workManager?.completed_today ?? []) {
    const label = item.company_name?.trim() || item.title
    entries.push({
      id: `work:${item.id}`,
      timeLabel: "Today",
      summary: humanizeOperatorFacingCopy(label.replace(/\.$/, "")),
    })
  }

  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = entry.summary.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildHomeWorkspaceHealthPresentation(input: {
  relationshipSnapshotCount?: number
  totalOpportunities?: number
  pendingApprovals?: number
  portfolio?: GrowthPortfolioManagerOperatorProjection | null
  leadsNeedingAction?: number
}): GrowthHomeWorkspaceHealthPresentation {
  const items: GrowthHomeWorkspaceHealthPresentation["items"] = []

  if ((input.relationshipSnapshotCount ?? 0) > 0) {
    items.push({
      id: "relationships",
      label: "Active relationships",
      value: String(input.relationshipSnapshotCount),
      tone: "neutral",
    })
  }

  if ((input.totalOpportunities ?? 0) > 0) {
    items.push({
      id: "opportunities",
      label: "Total opportunities",
      value: String(input.totalOpportunities),
      tone: "neutral",
    })
  }

  if ((input.pendingApprovals ?? 0) > 0) {
    items.push({
      id: "packages-awaiting",
      label: "Packages awaiting review",
      value: String(input.pendingApprovals),
      tone: "attention",
    })
  }

  if (input.portfolio) {
    items.push({
      id: "pipeline-health",
      label: "Pipeline health",
      value: humanizeOperatorFacingCopy(input.portfolio.healthLabel),
      tone: input.portfolio.healthState === "healthy" ? "healthy" : "attention",
    })
  } else if ((input.leadsNeedingAction ?? 0) > 0) {
    items.push({
      id: "leads-needing-action",
      label: "Leads needing action",
      value: String(input.leadsNeedingAction),
      tone: "attention",
    })
  }

  return {
    qaMarker: GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
    items,
  }
}

export function detectHomeSectionNarrativeOverlap(input: {
  heroNarrative: string
  workingNowTask: string | null
  objectiveTitle: string | null
  recommendationHeadline: string | null
  progressLabels: string[]
}): string[] {
  const overlaps: string[] = []
  const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? ""

  const hero = normalize(input.heroNarrative)
  const working = normalize(input.workingNowTask)
  const objective = normalize(input.objectiveTitle)
  const recommendation = normalize(input.recommendationHeadline)

  if (hero && working && hero === working) {
    overlaps.push("hero_working_now")
  }
  if (hero && objective && hero.includes(objective.slice(0, 24))) {
    overlaps.push("hero_objective")
  }
  if (working && recommendation && working.includes(recommendation.slice(0, 24))) {
    overlaps.push("working_now_recommendation")
  }

  for (const label of input.progressLabels) {
    const normalized = normalize(label)
    if (hero && normalized && hero.includes(normalized.slice(0, 20))) {
      overlaps.push("hero_progress")
      break
    }
  }

  return overlaps
}

/** GE-AIOS-LAUNCH-1A — Suppress duplicated narrative when sections repeat the same story. */
export function applyHomeNarrativeDedup(input: {
  overlaps: string[]
  heroBriefing: GrowthHomeHeroExecutiveBriefing
  workingNow: GrowthHomeWorkingNowPresentation
  recommendationHeadline: string | null
}): {
  heroBriefing: GrowthHomeHeroExecutiveBriefing
  workingNow: GrowthHomeWorkingNowPresentation
  suppressRecommendationHeadline: boolean
} {
  let workingNow = input.workingNow
  let suppressRecommendationHeadline = false

  if (input.overlaps.includes("hero_working_now")) {
    workingNow = {
      ...workingNow,
      activeTask: null,
    }
  }

  if (input.overlaps.includes("working_now_recommendation")) {
    suppressRecommendationHeadline = true
  }

  if (input.overlaps.includes("hero_objective")) {
    suppressRecommendationHeadline = true
  }

  return {
    heroBriefing: input.heroBriefing,
    workingNow,
    suppressRecommendationHeadline,
  }
}

export function filterCanonicalProgressToMeasurableOnly(
  progress: GrowthCanonicalOperatorProgressProjection | null | undefined,
): GrowthCanonicalOperatorProgressProjection | null {
  if (!progress) return null
  const measurableItems = progress.items.filter((item) => {
    if (/portfolio target:/i.test(item.label)) return true
    if (item.kind === "completed") return true
    if (/^\d+\s/.test(item.label)) return true
    if (/\d+\s\/\s\d+/.test(item.label)) return true
    return false
  })
  return {
    ...progress,
    subtitle: GROWTH_HOME_SECTION_PROGRESS_SUBTITLE,
    items: measurableItems,
  }
}
