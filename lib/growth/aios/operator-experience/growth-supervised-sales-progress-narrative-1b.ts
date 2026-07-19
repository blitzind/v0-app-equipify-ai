/**
 * GE-AIOS-OPERATOR-UX-1B — Supervised sales progress narrative (presentation-only).
 * Maps existing canonical Home read models into operator-facing stage copy.
 */

import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  buildGrowthReviewHref,
  resolveOperatorPackageReviewHref,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export const GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER =
  "ge-aios-operator-ux-1b-supervised-sales-progress-v1" as const

export const GROWTH_SUPERVISED_SALES_PRESENTATION_STAGES = [
  "discovering",
  "researching",
  "qualified",
  "package_ready",
  "waiting_for_authorization",
  "idle",
] as const

export type GrowthSupervisedSalesPresentationStage =
  (typeof GROWTH_SUPERVISED_SALES_PRESENTATION_STAGES)[number]

export type GrowthSupervisedSalesIdleVariant =
  | "no_mission"
  | "ava_working"
  | "no_qualified_results"
  | "profile_blocking"
  | "caught_up"

export type GrowthSupervisedSalesProgressNarrative = {
  qaMarker: typeof GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER
  primaryStage: GrowthSupervisedSalesPresentationStage
  headline: string
  supportingSentence: string | null
  secondaryContext: string | null
  completedSummary: string | null
  companyName: string | null
  count: number | null
  href: string | null
  ctaLabel: string | null
  operatorAttentionRequired: boolean
  /** When true, the canonical Home priority card already covers the headline. */
  headlineSuppressed: boolean
  idleVariant: GrowthSupervisedSalesIdleVariant | null
  sourceStates: string[]
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function qualifiedPreparingLeads(researchLoopSummary: GrowthAvaResearchLoopSummary | null | undefined) {
  return (researchLoopSummary?.leadResults ?? []).filter(
    (row) => row.qualificationStatus === "completed" && row.readyForOutreachReview !== true,
  )
}

function packageReviewHref(
  approvalSnapshot: GrowthCanonicalOperatorApprovalSnapshot | null | undefined,
): string {
  const packageId = approvalSnapshot?.topPackage?.packageId ?? null
  return resolveOperatorPackageReviewHref(packageId)
}

function missionRefinementHref(missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null | undefined): string {
  if (missionDiscovery?.missionId) {
    return `${GROWTH_WORKSPACE_BASE_PATH}?setup=find-leads`
  }
  return GROWTH_HOME_STARTUP_STEP_PATHS.findLeads
}

function buildSecondaryResearchContext(researchingCount: number, teammateName: string): string | null {
  if (researchingCount <= 0) return null
  return `${teammateName} is also researching ${researchingCount} additional ${pluralize(researchingCount, "company", "companies")}.`
}

function buildCompletedSummary(researchLoopSummary: GrowthAvaResearchLoopSummary | null | undefined): string | null {
  if (!researchLoopSummary) return null
  const parts: string[] = []
  if (researchLoopSummary.researchCompleted > 0) {
    parts.push(
      `Researched ${researchLoopSummary.researchCompleted} ${pluralize(researchLoopSummary.researchCompleted, "company", "companies")}`,
    )
  }
  if (researchLoopSummary.qualificationCompleted > 0) {
    parts.push(
      `qualified ${researchLoopSummary.qualificationCompleted} ${pluralize(researchLoopSummary.qualificationCompleted, "opportunity", "opportunities")}`,
    )
  }
  if (parts.length === 0) return null
  return parts.join(" and ") + " in the current batch."
}

export function projectSupervisedSalesProgressNarrative(input: {
  approvalSnapshot?: GrowthCanonicalOperatorApprovalSnapshot | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  researchLoopSummary?: GrowthAvaResearchLoopSummary | null
  teammateName?: string | null
}): GrowthSupervisedSalesProgressNarrative {
  const teammate = input.teammateName?.trim() || "Ava"
  const approvalSnapshot = input.approvalSnapshot ?? null
  const missionDiscovery = input.missionDiscovery ?? null
  const researchLoopSummary = input.researchLoopSummary ?? null
  const sourceStates: string[] = []

  const pendingApprovalCount = approvalSnapshot?.pendingApprovalCount ?? 0
  const waitingForOperator = approvalSnapshot?.waitingForOperator === true
  const topPackage = approvalSnapshot?.topPackage ?? null
  const packageCount = approvalSnapshot?.outreachPackageCount ?? 0
  const researchingCount = missionDiscovery?.counters.researchingCount ?? 0
  const draftsPrepared = missionDiscovery?.counters.draftsPrepared ?? 0
  const readyForOutreachReview = researchLoopSummary?.readyForOutreachReview ?? 0
  const qualifiedPreparing = qualifiedPreparingLeads(researchLoopSummary)
  const completedSummary = buildCompletedSummary(researchLoopSummary)

  const discoveringActive =
    missionDiscovery?.lifecycleState === "finding_leads" ||
    missionDiscovery?.discoveryAction === "run_prospect_search" ||
    missionDiscovery?.discoveryAction === "refresh_audience"
  const researchingActive =
    researchingCount > 0 || missionDiscovery?.lifecycleState === "researching"
  const qualifiedActive =
    qualifiedPreparing.length > 0 ||
    (missionDiscovery?.lifecycleState === "preparing_recommendations" &&
      pendingApprovalCount === 0 &&
      draftsPrepared === 0)
  const packageReadyActive =
    pendingApprovalCount === 0 &&
    (readyForOutreachReview > 0 || packageCount > 0)
  const waitingActive = pendingApprovalCount > 0 || waitingForOperator

  if (waitingActive) {
    sourceStates.push("approvalSnapshot.pendingApprovalCount", "approvalSnapshot.waitingForOperator")
    const companyName = topPackage?.companyName ?? null
    const count = pendingApprovalCount || packageCount
    const headline =
      companyName && count <= 1
        ? `${companyName} is waiting for your authorization.`
        : count === 1
          ? "1 outreach package is ready for your review."
          : `${count} outreach packages are waiting for your authorization.`
    const supportingSentence =
      count === 1
        ? "Authorize the prepared outreach package. Sending remains separately gated."
        : "Review and authorize the prepared outreach packages. Sending remains separately gated."

    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "waiting_for_authorization",
      headline,
      supportingSentence,
      secondaryContext: buildSecondaryResearchContext(researchingCount, teammate),
      completedSummary,
      companyName,
      count,
      href: packageReviewHref(approvalSnapshot),
      ctaLabel: "Review",
      operatorAttentionRequired: true,
      headlineSuppressed: true,
      idleVariant: null,
      sourceStates,
    }
  }

  if (packageReadyActive) {
    sourceStates.push("missionDiscovery.counters.draftsPrepared", "researchLoopSummary.readyForOutreachReview")
    const companyName = topPackage?.companyName ?? null
    const count = Math.max(packageCount, readyForOutreachReview)
    const headline =
      companyName && count <= 1
        ? "1 outreach package is ready for your review."
        : `${count} outreach ${pluralize(count, "package", "packages")} ${count === 1 ? "is" : "are"} ready for your review.`
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "package_ready",
      headline,
      supportingSentence: "I'll bring packages back here when they need your authorization.",
      secondaryContext: buildSecondaryResearchContext(researchingCount, teammate),
      completedSummary,
      companyName,
      count,
      href: packageReviewHref(approvalSnapshot),
      ctaLabel: "Review",
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: null,
      sourceStates,
    }
  }

  if (qualifiedActive) {
    sourceStates.push("researchLoopSummary.qualificationStatus=completed", "missionDiscovery.preparing_recommendations")
    const representative = qualifiedPreparing[0] ?? null
    const companyName = representative?.companyName?.trim() || null
    const count = Math.max(qualifiedPreparing.length, missionDiscovery?.lifecycleState === "preparing_recommendations" ? 1 : 0)
    const headline =
      companyName && count <= 1
        ? `${companyName} is qualified. ${teammate} is preparing the outreach package.`
        : `${count} ${pluralize(count, "company", "companies")} qualified. ${teammate} is preparing their outreach packages.`
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "qualified",
      headline,
      supportingSentence: "I'll bring this back to you when it is ready for authorization.",
      secondaryContext: buildSecondaryResearchContext(researchingCount, teammate),
      completedSummary,
      companyName,
      count,
      href: representative?.leadId ? buildGrowthLeadHref(representative.leadId) : null,
      ctaLabel: null,
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: null,
      sourceStates,
    }
  }

  if (researchingActive) {
    sourceStates.push("missionDiscovery.counters.researchingCount", "missionDiscovery.lifecycleState=researching")
    const count = Math.max(researchingCount, 1)
    const headline =
      count > 1
        ? `Researching ${count} companies. I'll prepare outreach packages only for qualified opportunities.`
        : `${teammate} is researching this company now.`
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "researching",
      headline,
      supportingSentence: "Not every researched company will qualify or receive a package.",
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: researchingCount > 0 ? researchingCount : null,
      href: null,
      ctaLabel: null,
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: null,
      sourceStates,
    }
  }

  if (discoveringActive && missionDiscovery?.startupDiscoveryReady) {
    sourceStates.push("missionDiscovery.lifecycleState=finding_leads", "missionDiscovery.discoveryAction")
    const target = missionDiscovery.audienceName?.trim() || missionDiscovery.searchSummary?.trim()
    const headline = target
      ? `${teammate} is discovering companies that match ${target}.`
      : `${teammate} is discovering companies that match your current mission.`
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "discovering",
      headline,
      supportingSentence: "Imported companies move into research once discovery finishes.",
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: missionDiscovery.newCompaniesFound > 0 ? missionDiscovery.newCompaniesFound : null,
      href: GROWTH_HOME_STARTUP_STEP_PATHS.findLeads,
      ctaLabel: "Find Leads",
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: null,
      sourceStates,
    }
  }

  if (!missionDiscovery) {
    sourceStates.push("missionDiscovery=null")
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "idle",
      headline: `Start a mission and ${teammate} will find, research, and prepare qualified opportunities for your review.`,
      supportingSentence: null,
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: null,
      href: GROWTH_HOME_STARTUP_STEP_PATHS.findLeads,
      ctaLabel: "Find Leads",
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: "no_mission",
      sourceStates,
    }
  }

  if (!missionDiscovery.startupDiscoveryReady) {
    sourceStates.push("missionDiscovery.startupDiscoveryReady=false")
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "idle",
      headline: "Complete your Growth Profile before discovery can begin.",
      supportingSentence: "Discovery stays paused until your profile is ready.",
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: null,
      href: GROWTH_HOME_STARTUP_STEP_PATHS.businessProfile,
      ctaLabel: "Growth Profile",
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: "profile_blocking",
      sourceStates,
    }
  }

  const batchResearched = (researchLoopSummary?.researchCompleted ?? 0) > 0
  const batchQualified = (researchLoopSummary?.qualificationCompleted ?? 0) === 0
  if (batchResearched && batchQualified) {
    sourceStates.push("researchLoopSummary.researchCompleted>0", "researchLoopSummary.qualificationCompleted=0")
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "idle",
      headline: `${teammate} completed the current batch, but none met the qualification threshold.`,
      supportingSentence: "Adjust your mission or search criteria to improve fit.",
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: researchLoopSummary?.researchCompleted ?? null,
      href: missionRefinementHref(missionDiscovery),
      ctaLabel: "Find Leads",
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: "no_qualified_results",
      sourceStates,
    }
  }

  const missionStillActive =
    missionDiscovery.lifecycleState !== "planning" &&
    (missionDiscovery.lifecycleState === "monitoring" ||
      missionDiscovery.discoveryAction === "monitoring" ||
      missionDiscovery.discoveryAction === "begin_research" ||
      missionDiscovery.discoveryAction === "follow_up")

  if (missionStillActive) {
    sourceStates.push("missionDiscovery.lifecycleState=monitoring", "missionDiscovery.discoveryAction")
    return {
      qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
      primaryStage: "idle",
      headline: `Nothing needs your attention. ${teammate} is continuing the current mission.`,
      supportingSentence: null,
      secondaryContext: null,
      completedSummary,
      companyName: null,
      count: null,
      href: buildGrowthReviewHref({ tab: "packages" }),
      ctaLabel: null,
      operatorAttentionRequired: false,
      headlineSuppressed: false,
      idleVariant: "ava_working",
      sourceStates,
    }
  }

  sourceStates.push("idle.default")
  return {
    qaMarker: GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
    primaryStage: "idle",
    headline: `Start a mission and ${teammate} will find, research, and prepare qualified opportunities for your review.`,
    supportingSentence: null,
    secondaryContext: null,
    completedSummary,
    companyName: null,
    count: null,
    href: GROWTH_HOME_STARTUP_STEP_PATHS.findLeads,
    ctaLabel: "Find Leads",
    operatorAttentionRequired: false,
    headlineSuppressed: false,
    idleVariant: "caught_up",
    sourceStates,
  }
}
