/**
 * GE-AIOS-HOME-RUNTIME-AUTHORITY-1B — Shared runtime execution precedence (client-safe).
 * Single authority resolver for Runtime Trust and Canonical Operator Progress.
 */

import type { GrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import {
  buildLeadDiscoveryWorkingNextLine,
  buildLeadDiscoveryWorkingNowLine,
} from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type {
  GrowthHomeCanonicalRuntimeActivityPayload,
  GrowthHomeRuntimeTrustPipelineStep,
} from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { humanizeOperatorFacingCopy } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER =
  "ge-aios-home-runtime-authority-1b-execution-presentation-v1" as const

export type GrowthHomeRuntimeExecutionScope = "lead" | "portfolio" | "operator_wait" | "idle"

export type GrowthHomePrimaryMissionKind =
  | "operator_review"
  | "prospect_research"
  | "draft_factory"
  | "portfolio_replenishment"
  | "portfolio_maintenance"
  | "idle"

export type GrowthHomeRuntimeExecutionPresentation = {
  qaMarker: typeof GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER
  precedenceRank: 1 | 2 | 3 | 4 | 5 | 6 | 7
  primaryMissionLabel: string | null
  primaryMissionKind: GrowthHomePrimaryMissionKind | null
  currentActivityLabel: string | null
  currentActivityScope: GrowthHomeRuntimeExecutionScope
  currentLeadCompanyName: string | null
  currentStepLabel: string | null
  nextMilestoneLabel: string | null
  pipelineSteps: GrowthHomeRuntimeTrustPipelineStep[]
  showLeadPipeline: boolean
  startedAt: string | null
  expectedCompletionMinutes: number | null
}

const LEAD_WORK_TYPES = new Set<AvaWorkItem["type"]>([
  "research",
  "qualification",
  "outreach",
  "approval",
  "reply",
  "meeting",
])

function formatClockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function humanizeStopReason(code: string | null | undefined): string | null {
  if (!code) return null
  switch (code) {
    case "portfolio_healthy":
      return "Monitoring portfolio health"
    case "no_executable_work":
      return "Waiting for the next work item"
    case "operator_required":
    case "operator_approval_required":
      return "Waiting for operator approval"
    default:
      return humanizeOperatorFacingCopy(code.replace(/_/g, " "))
  }
}

function primaryFocusMissionLabel(
  focus: GrowthProductionMissionAuthority["primaryFocus"] | null | undefined,
): string {
  switch (focus) {
    case "discovery":
      return "Portfolio Replenishment"
    case "research":
      return "Prospect Research"
    case "admission":
      return "Lead Admission"
    case "approvals":
      return "Operator Review"
    case "portfolio_health":
      return "Portfolio Maintenance"
    case "maintain_capacity":
      return "Portfolio Maintenance"
    default:
      return "Portfolio Maintenance"
  }
}

function primaryFocusMissionKind(
  focus: GrowthProductionMissionAuthority["primaryFocus"] | null | undefined,
): GrowthHomePrimaryMissionKind {
  switch (focus) {
    case "discovery":
      return "portfolio_replenishment"
    case "research":
      return "prospect_research"
    case "approvals":
      return "operator_review"
    default:
      return "portfolio_maintenance"
  }
}

function missionKindFromWorkType(type: AvaWorkItem["type"] | null | undefined): GrowthHomePrimaryMissionKind {
  if (type === "outreach" || type === "approval") return "draft_factory"
  if (type === "research" || type === "qualification") return "prospect_research"
  return "prospect_research"
}

function missionLabelFromKind(kind: GrowthHomePrimaryMissionKind): string {
  switch (kind) {
    case "operator_review":
      return "Operator Review"
    case "prospect_research":
      return "Prospect Research"
    case "draft_factory":
      return "Draft Factory"
    case "portfolio_replenishment":
      return "Portfolio Replenishment"
    case "portfolio_maintenance":
      return "Portfolio Maintenance"
    case "idle":
      return "Idle"
    default:
      return "Idle"
  }
}

export function describeWorkItemStep(activeWork: AvaWorkItem | null): string | null {
  if (!activeWork) return null
  const company = activeWork.company_name?.trim()
  switch (activeWork.type) {
    case "research":
      return company ? `Researching ${company}` : "Researching company"
    case "qualification":
      return company ? `Qualifying ${company}` : "Qualifying company"
    case "outreach":
      return company ? `Preparing outreach for ${company}` : "Preparing outreach"
    case "approval":
      return company ? `Outreach ready for your review — ${company}` : "Outreach waiting for your approval"
    case "reply":
      return company ? `Following up with ${company}` : "Following up"
    case "meeting":
      return company ? `Preparing for meeting with ${company}` : "Preparing for meeting"
    case "mission":
      return humanizeOperatorFacingCopy(activeWork.title)
    default:
      return humanizeOperatorFacingCopy(activeWork.title)
  }
}

export function buildLeadPipelineSteps(activeWork: AvaWorkItem | null): GrowthHomeRuntimeTrustPipelineStep[] {
  const type = activeWork?.type ?? null
  const stepOrder = [
    { id: "discovery", label: "Discovery", types: ["mission"] as AvaWorkItem["type"][] },
    { id: "research", label: "Research", types: ["research"] as AvaWorkItem["type"][] },
    { id: "qualification", label: "Qualification", types: ["qualification"] as AvaWorkItem["type"][] },
    { id: "decision_maker", label: "Decision maker", types: [] as AvaWorkItem["type"][] },
    { id: "buying_committee", label: "Buying committee", types: [] as AvaWorkItem["type"][] },
    { id: "package", label: "Package", types: ["outreach", "approval"] as AvaWorkItem["type"][] },
    { id: "operator_review", label: "Operator review", types: [] as AvaWorkItem["type"][] },
  ]

  let activeIndex = -1
  if (type === "research") activeIndex = 1
  else if (type === "qualification") activeIndex = 2
  else if (type === "outreach" || type === "approval") activeIndex = 5
  else if (type === "mission") activeIndex = 0
  else if (type === "reply" || type === "meeting") activeIndex = 6

  return stepOrder.map((step, index) => ({
    id: step.id,
    label: step.label,
    complete: activeIndex >= 0 && index < activeIndex,
    active: index === activeIndex,
  }))
}

function resolveNextLeadPipelineMilestone(activeWork: AvaWorkItem | null): string | null {
  const steps = buildLeadPipelineSteps(activeWork)
  const activeIndex = steps.findIndex((step) => step.active)
  if (activeIndex >= 0 && activeIndex + 1 < steps.length) {
    return steps[activeIndex + 1]?.label ?? null
  }
  return null
}

function isLeadLevelActiveWork(activeWork: AvaWorkItem | null | undefined): activeWork is AvaWorkItem {
  if (!activeWork) return false
  if (activeWork.type === "mission") return false
  return LEAD_WORK_TYPES.has(activeWork.type) || Boolean(activeWork.company_name?.trim())
}

function isPortfolioDiscoveryExecution(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
}): boolean {
  if (input.portfolioOperator?.discoveryRunning) return true
  if (input.productionMissionAuthority?.discoveryActive) return true
  const action = input.missionDiscovery?.discoveryAction
  return action === "run_prospect_search" || action === "refresh_audience" || action === "monitoring"
}

function portfolioActivityLabel(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): string {
  const status = input.portfolioOperator?.discoveryStatusDisplay?.trim()
  if (status && status !== "Idle") {
    if (/datamoon|discovery|search/i.test(status)) return status
    return `Running ${status}`
  }
  const missionLine = buildLeadDiscoveryWorkingNowLine(input.missionDiscovery)
  if (missionLine) return missionLine.replace(/\.$/, "")
  const activity = input.missionDiscovery?.activityLabel?.trim()
  if (activity) return activity
  return "Running DataMoon Discovery"
}

function portfolioStepLabel(input: {
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): string {
  return (
    input.portfolioOperator?.discoveryStatusDisplay?.trim() ||
    input.missionDiscovery?.activityLabel?.trim() ||
    "Discovery in progress"
  )
}

function resolveLeadCompanyName(input: {
  activeClaim?: GrowthHomeCanonicalRuntimeActivityPayload["activeClaim"] | null
  activeWork?: AvaWorkItem | null
  operatorApprovalCompanyName?: string | null
}): string | null {
  return (
    input.activeClaim?.companyName?.trim() ||
    input.activeWork?.company_name?.trim() ||
    input.operatorApprovalCompanyName?.trim() ||
    null
  )
}

function emptyPresentation(precedenceRank: GrowthHomeRuntimeExecutionPresentation["precedenceRank"]): GrowthHomeRuntimeExecutionPresentation {
  return {
    qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
    precedenceRank,
    primaryMissionLabel: "Idle",
    primaryMissionKind: "idle",
    currentActivityLabel: "Idle",
    currentActivityScope: "idle",
    currentLeadCompanyName: null,
    currentStepLabel: null,
    nextMilestoneLabel: null,
    pipelineSteps: [],
    showLeadPipeline: false,
    startedAt: null,
    expectedCompletionMinutes: null,
  }
}

export function resolveOperatorFocusPresentation(input: {
  canonicalOperatorFocus?: GrowthCanonicalOperatorFocus | null
}): {
  operatorFocusCompanyName: string | null
  operatorFocusHref: string | null
} {
  const company = input.canonicalOperatorFocus?.companyName?.trim()
  if (!company || company === "Account") {
    return { operatorFocusCompanyName: null, operatorFocusHref: null }
  }
  return {
    operatorFocusCompanyName: company,
    operatorFocusHref: input.canonicalOperatorFocus?.href ?? null,
  }
}

export function resolveRuntimeExecutionPresentation(input: {
  pendingApprovals: number
  operatorApprovalCompanyName?: string | null
  activeClaim?: GrowthHomeCanonicalRuntimeActivityPayload["activeClaim"] | null
  activeWork?: AvaWorkItem | null
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  autonomyTickHealth?: GrowthAiosAutonomyTickHealthSnapshot | null
}): GrowthHomeRuntimeExecutionPresentation {
  const leadCompany = resolveLeadCompanyName({
    activeClaim: input.activeClaim,
    activeWork: input.activeWork,
    operatorApprovalCompanyName: input.operatorApprovalCompanyName,
  })

  if (input.pendingApprovals > 0) {
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 1,
      primaryMissionLabel: "Operator Review",
      primaryMissionKind: "operator_review",
      currentActivityLabel: "Waiting for approval",
      currentActivityScope: "operator_wait",
      currentLeadCompanyName: leadCompany,
      currentStepLabel: "Waiting for approval",
      nextMilestoneLabel: "Review package",
      pipelineSteps: [],
      showLeadPipeline: false,
      startedAt: null,
      expectedCompletionMinutes: null,
    }
  }

  if (input.activeClaim) {
    const company = input.activeClaim.companyName?.trim() || leadCompany
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 2,
      primaryMissionLabel: "Prospect Research",
      primaryMissionKind: "prospect_research",
      currentActivityLabel: company ? `Researching ${company}` : "Researching company",
      currentActivityScope: "lead",
      currentLeadCompanyName: company,
      currentStepLabel: company ? `Researching ${company}` : "Researching company",
      nextMilestoneLabel: "Qualification",
      pipelineSteps:
        input.activeWork?.type === "research"
          ? buildLeadPipelineSteps(input.activeWork)
          : buildLeadPipelineSteps(null).map((step) => ({
              ...step,
              active: step.id === "research",
              complete: false,
            })),
      showLeadPipeline: true,
      startedAt: input.activeClaim.claimedAt,
      expectedCompletionMinutes: input.activeWork?.estimated_minutes ?? null,
    }
  }

  if (isLeadLevelActiveWork(input.activeWork)) {
    const work = input.activeWork
    const kind = missionKindFromWorkType(work.type)
    const step = describeWorkItemStep(work)
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 3,
      primaryMissionLabel: missionLabelFromKind(kind),
      primaryMissionKind: kind,
      currentActivityLabel: step,
      currentActivityScope: "lead",
      currentLeadCompanyName: work.company_name?.trim() ?? null,
      currentStepLabel: step,
      nextMilestoneLabel: resolveNextLeadPipelineMilestone(work),
      pipelineSteps: buildLeadPipelineSteps(work),
      showLeadPipeline: true,
      startedAt: work.updated_at ?? work.created_at ?? null,
      expectedCompletionMinutes: work.estimated_minutes ?? null,
    }
  }

  if (isPortfolioDiscoveryExecution(input)) {
    const activityLabel = portfolioActivityLabel(input)
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 4,
      primaryMissionLabel: "Portfolio Replenishment",
      primaryMissionKind: "portfolio_replenishment",
      currentActivityLabel: activityLabel,
      currentActivityScope: "portfolio",
      currentLeadCompanyName: null,
      currentStepLabel: portfolioStepLabel(input),
      nextMilestoneLabel:
        buildLeadDiscoveryWorkingNextLine(input.missionDiscovery)?.replace(/\.$/, "") ??
        (input.portfolioOperator?.nextBatchSize
          ? `Import next batch (${input.portfolioOperator.nextBatchSize})`
          : "Continue discovery"),
      pipelineSteps: [],
      showLeadPipeline: false,
      startedAt: null,
      expectedCompletionMinutes: null,
    }
  }

  if (input.productionMissionAuthority?.primaryFocus) {
    const focus = input.productionMissionAuthority.primaryFocus
    const kind = primaryFocusMissionKind(focus)
    const missionLine = buildLeadDiscoveryWorkingNowLine(input.missionDiscovery)
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 5,
      primaryMissionLabel: primaryFocusMissionLabel(focus),
      primaryMissionKind: kind,
      currentActivityLabel:
        missionLine?.replace(/\.$/, "") ||
        input.productionMissionAuthority.operatorSummaryLines[0] ||
        primaryFocusMissionLabel(focus),
      currentActivityScope: kind === "prospect_research" || kind === "draft_factory" ? "lead" : "portfolio",
      currentLeadCompanyName:
        kind === "prospect_research" || kind === "draft_factory" ? leadCompany : null,
      currentStepLabel:
        kind === "portfolio_replenishment" || kind === "portfolio_maintenance"
          ? portfolioStepLabel(input)
          : describeWorkItemStep(input.activeWork ?? null),
      nextMilestoneLabel:
        buildLeadDiscoveryWorkingNextLine(input.missionDiscovery)?.replace(/\.$/, "") ??
        input.productionMissionAuthority.operatorSummaryLines[1] ??
        null,
      pipelineSteps: input.activeWork && isLeadLevelActiveWork(input.activeWork)
        ? buildLeadPipelineSteps(input.activeWork)
        : [],
      showLeadPipeline: Boolean(input.activeWork && isLeadLevelActiveWork(input.activeWork)),
      startedAt: input.activeWork?.updated_at ?? input.activeWork?.created_at ?? null,
      expectedCompletionMinutes: input.activeWork?.estimated_minutes ?? null,
    }
  }

  const tick = input.autonomyTickHealth
  if (tick?.selectedWorkType || tick?.stopReason) {
    const label =
      humanizeOperatorFacingCopy(tick.selectedWorkType?.replace(/_/g, " ") ?? "") ||
      humanizeStopReason(tick.stopReason) ||
      "Scheduled autonomous work"
    return {
      qaMarker: GROWTH_HOME_RUNTIME_EXECUTION_PRESENTATION_1B_QA_MARKER,
      precedenceRank: 6,
      primaryMissionLabel: label,
      primaryMissionKind: "portfolio_maintenance",
      currentActivityLabel: label,
      currentActivityScope: "portfolio",
      currentLeadCompanyName: null,
      currentStepLabel: label,
      nextMilestoneLabel: null,
      pipelineSteps: [],
      showLeadPipeline: false,
      startedAt: null,
      expectedCompletionMinutes: null,
    }
  }

  return emptyPresentation(7)
}

export function resolveRuntimeExecutionActiveLabel(
  input: Parameters<typeof resolveRuntimeExecutionPresentation>[0],
): string | null {
  const presentation = resolveRuntimeExecutionPresentation(input)
  if (presentation.currentActivityScope === "lead" && presentation.currentLeadCompanyName) {
    return presentation.currentLeadCompanyName
  }
  return presentation.currentActivityLabel
}

export function formatRuntimeExecutionStartedLabel(startedAt: string | null): string | null {
  if (!startedAt) return null
  return formatClockTime(startedAt)
}
