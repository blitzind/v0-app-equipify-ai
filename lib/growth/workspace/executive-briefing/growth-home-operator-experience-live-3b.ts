/**
 * GE-AIOS-LIVE-3B / LIVE-3C — Home operator experience presentation (no new projections).
 */

import type { GrowthCanonicalOperatorProgressProjection } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeRuntimeTrustPipelineStep } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { SalesOutcome, SalesOutcomeDailySummary } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { AvaDailyActivityNarrative } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import { buildNarrativeIntelligenceOpeningLine } from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import {
  buildLeadDiscoveryWorkingNextLine,
  buildLeadDiscoveryWorkingNowLine,
} from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import {
  GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER,
  packagePreparationInProgressPhrase,
  packagePreparationMilestonePhrase,
  portfolioBelowTargetDiscoveryReasonPhrase,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-truthfulness-1b"

export { GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-truthfulness-1b"

export const GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER =
  "ge-aios-live-3b-home-operator-experience-v1" as const

export const GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER =
  "ge-aios-live-3c-human-centered-home-language-v1" as const

export const GROWTH_HOME_OPERATOR_EXPERIENCE_2A_QA_MARKER =
  "ge-aios-home-operator-experience-2a-v1" as const

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

function humanizePortfolioActivityStatus(text: string): string {
  const nextBatch = text.match(/^Next batch:\s*(\d+)\s*$/i)
  if (nextBatch?.[1]) {
    return `Running discovery batch (${nextBatch[1]} companies)`
  }
  const runningNextBatch = text.match(/^Running Next batch:\s*(\d+)\s*$/i)
  if (runningNextBatch?.[1]) {
    return `Running discovery batch (${runningNextBatch[1]} companies)`
  }
  if (/^Searching$/i.test(text)) return "Running discovery batch"
  if (/^Running DataMoon Discovery$/i.test(text)) return "Running discovery batch"
  return text
}

export function humanizeOperatorFacingCopy(text: string | null | undefined): string {
  if (!text?.trim()) return ""
  let copy = humanizePortfolioActivityStatus(text.trim())
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

export function parseOperatorFocusConfidenceLine(detail: string | null | undefined): {
  confidenceLine: string | null
  explanation: string | null
} {
  const raw = detail?.trim()
  if (!raw) return { confidenceLine: null, explanation: null }
  const percentMatch = raw.match(/(\d{1,3})%/i)
  if (!percentMatch) return { confidenceLine: null, explanation: humanizeOperatorFacingCopy(raw) }
  const confidenceLine = `${percentMatch[1]}% confidence`
  const explanation = humanizeOperatorFacingCopy(
    raw
      .replace(new RegExp(`${percentMatch[1]}%\\s*confidence`, "i"), "")
      .replace(/^[\s—–-]+/, "")
      .replace(/[\s—–-]+$/, "")
      .trim(),
  )
  return {
    confidenceLine,
    explanation: explanation || null,
  }
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

function portfolioBelowTarget(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
}): boolean {
  if (input.productionMissionAuthority?.portfolioBelowTarget === true) return true
  const portfolio = input.portfolioOperator
  if (!portfolio) return false
  return portfolio.currentActiveCompanies < portfolio.targetActiveCompanies
}

function portfolioBelowTargetReason(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
}): string | null {
  if (!portfolioBelowTarget(input)) return null
  return portfolioBelowTargetDiscoveryReasonPhrase()
}

function extractCompanyFromActivityLabel(label: string | null | undefined): string | null {
  const activity = humanizeOperatorFacingCopy(label)
  if (!activity) return null
  const match =
    activity.match(/^Researching\s+(.+)$/i) ??
    activity.match(/^Qualifying\s+(.+)$/i) ??
    activity.match(/^Preparing outreach for\s+(.+)$/i) ??
    activity.match(/^Following up with\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function isLeadExecutionActivity(label: string | null | undefined): boolean {
  const activity = humanizeOperatorFacingCopy(label)
  if (!activity) return false
  return /^(Researching|Qualifying|Preparing outreach|Following up with)\s+/i.test(activity)
}

function isDiscoveryExecution(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  primaryMissionLabel?: string | null
}): boolean {
  if (input.portfolioOperator?.discoveryRunning) return true
  if (input.productionMissionAuthority?.discoveryActive) return true
  if (input.primaryMissionLabel === "Portfolio Replenishment") return true
  const action = input.missionDiscovery?.discoveryAction
  return action === "run_prospect_search" || action === "refresh_audience"
}

function pipelineGrowthOutcomeLine(): string {
  return "I'm building the next group of qualified companies for outreach to keep our sales pipeline growing."
}

function buildDiscoveryExecutiveParagraph(input: {
  batchSize: number | null | undefined
  belowTargetReason: string | null
  monitoringReplies: boolean
  currentActivityLabel?: string | null
}): string {
  const outcome = pipelineGrowthOutcomeLine()
  const prospectCount = input.batchSize && input.batchSize > 0 ? input.batchSize : null
  const rawActivity = humanizeOperatorFacingCopy(input.currentActivityLabel)
  const activity = prospectCount
    ? `Right now I'm researching ${prospectCount} new prospects`
    : ensureFirstPerson(rawActivity || "I'm searching for matching companies")
  const reason = input.belowTargetReason ? ` because ${input.belowTargetReason}` : ""
  const parallel = input.monitoringReplies ? ", and I'm monitoring replies from earlier outreach in parallel" : ""
  return `${outcome} ${activity}${reason}${parallel}.`
}

function buildExecutiveOpeningParagraph(input: {
  statusLabel: string
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  primaryMissionLabel?: string | null
  currentActivityLabel?: string | null
  repliesToday?: number
  pendingPackages: number
  preparingOutreach: number
}): string {
  const monitoringReplies = (input.repliesToday ?? 0) > 0
  const replySuffix = monitoringReplies ? " I'm also monitoring replies from earlier outreach." : ""
  const batchSize = input.portfolioOperator?.nextBatchSize
  const belowTargetReason = portfolioBelowTargetReason(input)

  if (input.pendingPackages > 0) {
    const packagePhrase =
      input.pendingPackages === 1
        ? "the next outreach package is ready for your review"
        : `${input.pendingPackages} outreach packages are ready for your review`
    return `I've prepared qualified outreach so we can keep sales momentum, and ${packagePhrase}, so we only contact companies you've approved.`
  }

  if (
    (input.statusLabel === "Idle" || input.primaryMissionLabel === "Portfolio Maintenance") &&
    !portfolioBelowTarget(input) &&
    input.portfolioOperator?.discoveryRunning !== true
  ) {
    return `Your active portfolio is healthy. I'll continue monitoring the pipeline and let you know as soon as a review-ready opportunity needs your attention.${replySuffix}`
  }

  if (isLeadExecutionActivity(input.currentActivityLabel)) {
    const company =
      extractCompanyFromActivityLabel(input.currentActivityLabel) ??
      humanizeOperatorFacingCopy(input.currentActivityLabel)
    const activity = ensureFirstPerson(humanizeOperatorFacingCopy(input.currentActivityLabel) || "")
    const activitySuffix = activity ? ` ${activity}${replySuffix || "."}` : replySuffix || "."
    return `I'm advancing ${company} toward a review-ready outreach package that can become a sales opportunity.${activitySuffix}`
  }

  if (input.preparingOutreach > 0) {
    const countPhrase = packagePreparationInProgressPhrase(input.preparingOutreach)
    return `I'm strengthening the sales pipeline with ${countPhrase}${monitoringReplies ? ", while monitoring replies from earlier outreach in parallel" : ""}.`
  }

  if (isDiscoveryExecution(input)) {
    return buildDiscoveryExecutiveParagraph({
      batchSize,
      belowTargetReason,
      monitoringReplies,
      currentActivityLabel: input.currentActivityLabel,
    })
  }

  if (input.statusLabel === "Researching companies" || input.primaryMissionLabel === "Prospect Research") {
    return `I'm advancing the next qualified company toward a review-ready outreach package that can become a sales opportunity${monitoringReplies ? ", while monitoring replies from earlier outreach in parallel" : ""}.`
  }

  if (input.statusLabel === "Preparing outreach" || input.primaryMissionLabel === "Draft Factory") {
    return `I'm preparing the next outreach package so you can review it before anything is sent, keeping sales momentum under your control${monitoringReplies ? ", while monitoring replies from earlier outreach in parallel" : ""}.`
  }

  if (discoveryActive(input)) {
    return buildDiscoveryExecutiveParagraph({
      batchSize,
      belowTargetReason,
      monitoringReplies,
      currentActivityLabel: input.currentActivityLabel,
    })
  }

  if (input.statusLabel && input.statusLabel !== "Idle") {
    return `I'm keeping today's sales pipeline moving on ${input.statusLabel.charAt(0).toLowerCase()}${input.statusLabel.slice(1)}${monitoringReplies ? ", while monitoring replies from earlier outreach in parallel" : ""}.`
  }

  const fallback = buildNarrativeIntelligenceOpeningLine({
    focus: input.dailyActivityNarrative?.focus ?? "idle",
    packageCount: input.pendingPackages,
    waitingCount: input.dailyActivityNarrative?.waiting_on_you.length ?? 0,
    completedCount: input.dailyActivityNarrative?.completed_today.length ?? 0,
    setupIncomplete: false,
    discoveryTarget: input.missionDiscovery?.audienceName ?? null,
  })
  return (
    humanizeOperatorFacingCopy(fallback) ||
    `I'm monitoring the pipeline and will advance the next highest-value sales opportunity${monitoringReplies ? ", while monitoring replies from earlier outreach in parallel" : ""}.`
  )
}

function operatorNeedLine(pendingPackages: number): string {
  if (pendingPackages <= 0) {
    return "I don't currently need anything from you."
  }
  if (pendingPackages === 1) {
    return "I need your review on one outreach package before I continue."
  }
  return `I need your review on ${pendingPackages} outreach packages before I continue.`
}

function executiveNextMilestoneLine(input: {
  pendingPackages: number
  preparingOutreach: number
  canonicalOperatorFocus?: GrowthCanonicalOperatorFocus | null
  primaryMissionLabel?: string | null
  currentActivityLabel?: string | null
  portfolioBelowTarget: boolean
  statusLabel: string
}): string {
  if (input.pendingPackages > 0) {
    return input.pendingPackages === 1
      ? "After your review, I'll continue progressing the next highest-value opportunity."
      : "After your review, I'll continue progressing the next highest-value opportunities."
  }

  if (input.preparingOutreach > 0) {
    return packagePreparationMilestonePhrase(input.preparingOutreach)
  }

  const focus = input.canonicalOperatorFocus
  const company = focus?.companyName?.trim()
  const detail = humanizeOperatorFacingCopy(focus?.detail)?.toLowerCase() ?? ""

  if (/buying committee/.test(detail)) {
    return company
      ? `Once buying committee verification is complete at ${company}, I'll prepare the outreach package for your approval.`
      : "Once buying committee verification is complete, I'll prepare the outreach package for your approval."
  }

  if (/^waiting on\s+/i.test(detail)) {
    const blocker = detail.replace(/^waiting on\s+/i, "").replace(/\.$/, "")
    if (blocker) {
      return `Once ${blocker} is complete, I'll prepare the outreach package for your approval.`
    }
  }

  if (isLeadExecutionActivity(input.currentActivityLabel)) {
    const leadCompany = extractCompanyFromActivityLabel(input.currentActivityLabel)
    if (/researching/i.test(input.currentActivityLabel ?? "")) {
      return leadCompany
        ? `Once research is complete, I'll prepare a review-ready outreach package for ${leadCompany}.`
        : "Once research is complete, I'll prepare the next review-ready outreach package for your approval."
    }
    return "My next step is preparing a review-ready outreach package for your approval."
  }

  if (input.portfolioBelowTarget || isDiscoveryExecution({ primaryMissionLabel: input.primaryMissionLabel })) {
    return "I'll continue qualifying companies until the next review-ready opportunity is available."
  }

  if (input.statusLabel === "Idle" || input.primaryMissionLabel === "Portfolio Maintenance") {
    return "I'll continue qualifying companies until the next review-ready opportunity is available."
  }

  return "My next objective is preparing the next review-ready opportunity for your approval."
}

function ensureFirstPerson(line: string): string {
  const trimmed = line.trim()
  if (/^I['’]?m\b/i.test(trimmed) || /^I['’]?ve\b/i.test(trimmed) || /^I\b/i.test(trimmed)) return trimmed
  if (/^Running\b/i.test(trimmed)) return `I'm ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
  if (/^Searching\b/i.test(trimmed)) return `I'm ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
  if (/^Researching\b/i.test(trimmed)) return `I'm ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
  if (/^Building\b/i.test(trimmed)) return `I'm ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
  if (/^Waiting\b/i.test(trimmed)) return `I'm ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
  return trimmed
}

export function buildHeroExecutiveBriefing(input: {
  statusLabel: string
  dailyActivityNarrative?: AvaDailyActivityNarrative | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  pendingApprovals?: number
  readyForOutreachReview?: number
  discoveryTarget?: string | null
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  primaryMissionLabel?: string | null
  currentActivityLabel?: string | null
  repliesToday?: number
  canonicalOperatorFocus?: GrowthCanonicalOperatorFocus | null
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

  paragraphs.push(
    buildExecutiveOpeningParagraph({
      statusLabel: input.statusLabel,
      dailyActivityNarrative: input.dailyActivityNarrative,
      missionDiscovery: input.missionDiscovery,
      portfolioOperator: input.portfolioOperator,
      productionMissionAuthority: input.productionMissionAuthority,
      primaryMissionLabel: input.primaryMissionLabel,
      currentActivityLabel: input.currentActivityLabel,
      repliesToday: input.repliesToday,
      pendingPackages,
      preparingOutreach,
    }),
  )

  paragraphs.push(operatorNeedLine(pendingPackages))

  paragraphs.push(
    executiveNextMilestoneLine({
      pendingPackages,
      preparingOutreach,
      canonicalOperatorFocus: input.canonicalOperatorFocus,
      primaryMissionLabel: input.primaryMissionLabel,
      currentActivityLabel: input.currentActivityLabel,
      portfolioBelowTarget: portfolioBelowTarget(input),
      statusLabel: input.statusLabel,
    }),
  )

  const sanitized = paragraphs
    .map((paragraph) => humanizeOperatorFacingCopy(paragraph))
    .filter(Boolean)
    .slice(0, 3)

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
  if ((summary?.outreach_prepared ?? 0) > 0) {
    items.push({
      id: "outreach-drafts-created",
      label: "Outreach drafts created",
      value: String(summary!.outreach_prepared),
    })
  }

  if ((input.pendingApprovals ?? 0) > 0) {
    items.push({
      id: "packages-awaiting-review",
      label: "Waiting for approval",
      value: String(input.pendingApprovals),
    })
  }

  if ((input.readyForOutreachReview ?? 0) > 0) {
    items.push({
      id: "ready-for-outreach-review",
      label: "Drafts in progress",
      value: String(input.readyForOutreachReview),
    })
  }

  if (summary?.researched != null && summary.researched > 0) {
    items.push({ id: "researched", label: "Researched today", value: String(summary.researched) })
  }
  if (summary?.qualified != null && summary.qualified > 0) {
    items.push({ id: "qualified", label: "Qualified today", value: String(summary.qualified) })
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
