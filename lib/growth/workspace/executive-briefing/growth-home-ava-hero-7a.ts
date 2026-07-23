/**
 * GE-AIOS-7A / GE-AIOS-14B — Unified Ava home hero (client-safe presentation builder).
 *
 * When workspace summary inputs are present, composes the canonical AI OS stack:
 * Memory → Decision → Work Manager → Specialist → Operating Rhythm → Narrative.
 * Without workspace summary, falls back to lightweight 7A presentation helpers.
 */

import { buildAvaDailyBriefing } from "@/lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { buildRelationshipLeadSnapshotsFromResearchLoop, mergeRelationshipLeadSnapshotMaps } from "@/lib/growth/relationship/project-relationship-graph-enrichment"
import {
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
  type AvaDailyBriefing,
  type AvaNarrativeMetricsSnapshot,
  type AvaStoryBlock,
} from "@/lib/growth/ava-home/narrative/narrative-types"
import { AVA_NARRATIVE_ALL_NORMAL_LINE } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { AvaMemorySummary, AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import type { AvaOperatingRhythm, AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"
import type { AvaSpecialistOrchestratorResult } from "@/lib/growth/specialists/types"
import { buildPrimaryDecisionFromWorkManager } from "@/lib/growth/work-manager/home/build-primary-decision-work"
import { projectCanonicalDecisionToHomePrimary } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { GrowthCanonicalOperatorDecisionProjection } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeAiEmployeeStatus,
  GrowthHomeAiOsUxViewModel,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildPersonalizedHomeGreeting,
} from "@/lib/growth/home/growth-home-living-experience-18e"
import { resolveHomeOperatorEmployeeStatusFromMission } from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import {
  formatOperatorWaitingActivityLabel,
  GROWTH_OPERATOR_REVIEW_CTA_LABEL,
  GROWTH_OPERATOR_STATUS_READY_FOR_REVIEW,
} from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { remapLegacyHrefToGrowthReview, resolveCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import {
  projectSupervisedSalesProgressNarrative,
  type GrowthSupervisedSalesProgressNarrative,
} from "@/lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import { buildGrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"
import type { GrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import { buildGrowthHomeAvaStrategicLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f"
import type { GrowthHomeAvaStrategicLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"
import type { GrowthHomeAvaStrategicOverrideRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import type { GrowthHomeAvaStrategicAdvisorContextPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import { buildGrowthHomeAvaContinuousExecutiveBriefingPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-continuous-executive-briefing-next-2a"
import type { GrowthHomeAvaContinuousExecutiveBriefingPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import type { GrowthHomeAvaExecutiveBriefingCursor } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import type { GrowthHomeAvaRecommendationPreferenceRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import { enrichGrowthHomeExecutiveLanguageNext3c } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-language-enrichment-next-3c"
import { enrichGrowthHomeOrganizationalLearningNext3d } from "@/lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3d"
import { enrichExecutiveReasoningWithLearningCertificationNext3e } from "@/lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3e"
import { buildGrowthHomeAvaRecommendationAccountabilityNext3d } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type { GrowthOrganizationalEffectivenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"
import { buildGrowthOrganizationalLearningCertificationNext3e } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e"
import type { GrowthOrganizationalLearningCertificationSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"
import type { GrowthHomeAvaExecutiveReasoningPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"
import type { GrowthHomeAvaRecommendationAccountabilitySnapshot } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"

function normalizeOperatorReviewHref(
  href: string | null | undefined,
  leadId?: string | null,
): string | null {
  if (!href) return null
  const customerHref = resolveCustomerPackageReviewHref({ leadId, route: href })
  if (customerHref) return customerHref
  return remapLegacyHrefToGrowthReview(href)
}

export const GROWTH_HOME_AVA_HERO_7A_QA_MARKER = "growth-ge-aios-7a-ava-home-experience-v1" as const

export const GROWTH_HOME_AVA_ALL_NORMAL_LINE = AVA_NARRATIVE_ALL_NORMAL_LINE
/** @deprecated GE-AIOS-14B — narrative engine replaces activity pills */
export const GROWTH_HOME_AVA_ONE_THING_TITLE = "I only need one thing from you" as const
/** @deprecated GE-AIOS-14B — narrative engine replaces activity pills */
export const GROWTH_HOME_AVA_CURRENTLY_TITLE = "Currently" as const
/** @deprecated GE-AIOS-14B — narrative engine replaces since-last-visit list */
export const GROWTH_HOME_AVA_SINCE_LAST_VISIT_TITLE = "Since your last visit" as const

export type GrowthHomeAvaHeroActivity = { id: string; label: string }
export type GrowthHomeAvaHeroAccomplishment = { id: string; label: string }
export type GrowthHomeAvaHeroDecision = {
  id: string
  label: string
  detail: string | null
  href: string | null
  canonicalProjection?: GrowthCanonicalOperatorDecisionProjection | null
}

export type GrowthHomeAvaHeroViewModel = {
  qaMarker: typeof GROWTH_HOME_AVA_HERO_7A_QA_MARKER
  greeting: string
  statusLabel: string
  statusKind: GrowthHomeAiEmployeeStatus["kind"]
  currentActivities: GrowthHomeAvaHeroActivity[]
  sinceLastVisit: GrowthHomeAvaHeroAccomplishment[]
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
  allNormalLine: string
  dailyBriefing?: AvaDailyBriefing
  dailyActivityNarrative?: import("@/lib/growth/ava-home/narrative/narrative-types").AvaDailyActivityNarrative | null
  storyBlocks: AvaStoryBlock[]
  briefingNarrative: string[]
  workManager?: AvaWorkManagerResult
  operatingRhythm?: AvaOperatingRhythm
  memorySummary?: AvaMemorySummary
  specialistOrchestrator?: AvaSpecialistOrchestratorResult | null
  /** GE-AIOS-18G — Active discovery target for opening line */
  discoveryNarrativeTarget?: string | null
  /** GE-AIOS-OPERATOR-UX-1B — Supervised sales journey narrative */
  supervisedSalesProgress?: GrowthSupervisedSalesProgressNarrative | null
  /** GE-AIOS-NEXT-1A — Ranked recommendation-driven Home experience */
  recommendationExperience?: GrowthHomeAvaRecommendationExperience | null
  /** GE-AIOS-NEXT-1E — Business objective leadership centerpiece */
  businessObjectiveLeadership?: import("@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types").GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
  /** GE-AIOS-NEXT-1F — Strategic leadership (insights + executive briefing footer) */
  strategicLeadership?: GrowthHomeAvaStrategicLeadershipPayload | null
  /** GE-AIOS-NEXT-2A — Continuous executive briefing handoff */
  continuousExecutiveBriefing?: GrowthHomeAvaContinuousExecutiveBriefingPayload | null
  /** GE-AIOS-NEXT-3C — Evidence-backed executive reasoning */
  executiveReasoning?: GrowthHomeAvaExecutiveReasoningPayload | null
  /** GE-AIOS-NEXT-3D — Recommendation accountability / organizational learning */
  recommendationAccountability?: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
  /** GE-AIOS-NEXT-3E — Organizational learning certification projection */
  organizationalLearningCertification?: GrowthOrganizationalLearningCertificationSnapshot | null
}

export type BuildAvaHomeHeroInput = {
  greeting: string
  hour: number
  employeeStatus: GrowthHomeAiEmployeeStatus
  aiOsUx: GrowthHomeAiOsUxViewModel
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  accomplishments: GrowthHomeAccomplishmentGroup[]
  repliesWaiting: number
  workspaceSummary?: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    | "kpis"
    | "meetings"
    | "inbox"
    | "operatorTasks"
    | "avaConsole"
    | "dashboard"
    | "relationshipSnapshots"
    | "leadPool"
    | "missionDiscovery"
    | "portfolioLeads"
    | "eligibleLeadCount"
    | "businessObjectiveLeadership"
    | "canonicalPortfolioAuthority"
  >
  waitingOnYou?: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue?: GrowthHomeDailyWorkQueueItem[]
  timeline?: GrowthHomeTimelinePeriod[]
  previousSnapshot?: AvaNarrativeMetricsSnapshot | null
  operatingRhythmMemory?: AvaOperatingRhythmMemory | null
  persistedMemoryStore?: AvaOrganizationalMemoryStore | null
  organizationId?: string
  generatedAt?: string
  /** GE-AIOS-15E — explicit server snapshots (override research-loop projections) */
  relationshipSnapshotsById?: import("@/lib/growth/relationship/relationship-lead-snapshot-types").RelationshipLeadSnapshotMap
  salesOutcomes?: import("@/lib/growth/specialists/execution/sales-outcome-types").GrowthHomeSalesOutcomesPayload | null
  organizationalKnowledge?: import("@/lib/growth/memory/knowledge/organization-knowledge-types").OrganizationalKnowledgeItem[] | null
  operatorDisplayName?: string | null
  /** GE-AIOS-DECISION-ENGINE-1B — server-resolved canonical hero decision */
  canonicalHeroDecision?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types").GrowthCanonicalDecisionResolution | null
  strategicAdvisorContext?: GrowthHomeAvaStrategicAdvisorContextPayload | null
  overrideRecords?: GrowthHomeAvaStrategicOverrideRecord[]
  executiveBriefingCursor?: GrowthHomeAvaExecutiveBriefingCursor | null
  recommendationPreferences?: GrowthHomeAvaRecommendationPreferenceRecord[]
  outboundDisabled?: boolean
  outboundWaitingForBusinessHours?: boolean
  /** GE-AIOS-NEXT-3B/3C — Organizational evidence completeness (optional server projection) */
  organizationalEvidenceCompleteness?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
  /** GE-AIOS-NEXT-3D — Pre-built accountability snapshot (optional server projection) */
  recommendationAccountability?: GrowthHomeAvaRecommendationAccountabilitySnapshot | null
  /** GE-AIOS-NEXT-3E — Pre-built learning certification (optional server projection) */
  organizationalLearningCertification?: GrowthOrganizationalLearningCertificationSnapshot | null
  /** GE-AIOS-NEXT-3A — Baseline snapshot for attribution windows (optional server projection) */
  organizationalEffectivenessBaseline?: GrowthOrganizationalEffectivenessSnapshot | null
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/** GE-AIOS-7A — What Ava is doing now (Phase 4 dynamic status), from existing state. */
export function buildAvaCurrentActivities(input: {
  employeeStatus: GrowthHomeAiEmployeeStatus
  aiOsUx: GrowthHomeAiOsUxViewModel
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  repliesWaiting: number
}): GrowthHomeAvaHeroActivity[] {
  const { employeeStatus, aiOsUx, researchLoopSummary, repliesWaiting } = input
  const waitingCount = Math.max(aiOsUx.approveItemsCount, aiOsUx.waitingOnYou.length)
  const readyForReview = researchLoopSummary?.readyForOutreachReview ?? 0
  const researched = researchLoopSummary?.researchCompleted ?? 0

  const activities: GrowthHomeAvaHeroActivity[] = []

  if (employeeStatus.kind === "researching" || researched > 0 || aiOsUx.dailyWorkQueue.length > 0) {
    activities.push({ id: "researching", label: "Researching leads" })
  }
  if (employeeStatus.kind === "monitoring_replies" || repliesWaiting > 0) {
    activities.push({ id: "monitoring", label: "Monitoring replies" })
  }
  if (employeeStatus.kind === "preparing_outreach" || readyForReview > 0) {
    activities.push({ id: "preparing", label: "Preparing opportunities" })
  }
  if (employeeStatus.kind === "waiting_for_approval" || aiOsUx.approveItemsCount > 0) {
    activities.push({
      id: "waiting",
      label: formatOperatorWaitingActivityLabel(aiOsUx.approveItemsCount),
    })
  }

  if (activities.length === 0) {
    activities.push({ id: "status", label: employeeStatus.label })
  }

  return activities
}

/** GE-AIOS-7A — What Ava accomplished (Phase 2 "Since your last visit"), from existing state. */
export function buildAvaSinceLastVisit(input: {
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  accomplishments: GrowthHomeAccomplishmentGroup[]
}): GrowthHomeAvaHeroAccomplishment[] {
  const { researchLoopSummary, accomplishments } = input
  const items: GrowthHomeAvaHeroAccomplishment[] = []

  if (researchLoopSummary) {
    const { researchCompleted, qualificationCompleted, readyForOutreachReview, buyingSignalsVerified } =
      researchLoopSummary
    if (researchCompleted > 0) {
      items.push({
        id: "researched",
        label: `researched ${researchCompleted} ${pluralize(researchCompleted, "company", "companies")}`,
      })
    }
    if (qualificationCompleted > 0) {
      items.push({ id: "qualified", label: `qualified ${qualificationCompleted}` })
    }
    if (readyForOutreachReview > 0) {
      items.push({
        id: "prepared",
        label: `prepared ${readyForOutreachReview} ${pluralize(readyForOutreachReview, "opportunity", "opportunities")}`,
      })
    }
    if (buyingSignalsVerified > 0) {
      items.push({
        id: "signals",
        label: `verified buying signals at ${buyingSignalsVerified} ${pluralize(buyingSignalsVerified, "company", "companies")}`,
      })
    }
  }

  for (const group of accomplishments) {
    for (const item of group.items) {
      if (items.length >= 4) break
      const trimmed = item.trim()
      if (!trimmed) continue
      const id = `${group.id}:${trimmed.slice(0, 32)}`
      if (items.some((existing) => existing.label.toLowerCase() === trimmed.toLowerCase())) continue
      items.push({ id, label: trimmed })
    }
  }

  return items.slice(0, 4)
}

/** GE-AIOS-7A — The single decision Ava needs (Phase 2 "one thing"), from canonical operator task. */
export function buildAvaPrimaryDecision(aiOsUx: GrowthHomeAiOsUxViewModel): {
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
} {
  const canonical = aiOsUx.canonicalOperatorTask
  if (canonical) {
    return {
      primaryDecision: {
        id: canonical.id,
        label: canonical.title,
        detail: [canonical.detail, canonical.why].filter(Boolean).join(" · ") || null,
        href: normalizeOperatorReviewHref(canonical.href ?? aiOsUx.approveItemsHref),
      },
      additionalDecisionCount: Math.max(0, aiOsUx.approveItemsCount - 1),
      reviewAllHref: normalizeOperatorReviewHref(aiOsUx.approveItemsHref),
    }
  }

  const top = aiOsUx.waitingOnYou[0] ?? null
  const totalWaiting = Math.max(aiOsUx.approveItemsCount, aiOsUx.waitingOnYou.length)

  if (!top && totalWaiting === 0) {
    return { primaryDecision: null, additionalDecisionCount: 0, reviewAllHref: null }
  }

  const primaryDecision: GrowthHomeAvaHeroDecision | null = top
    ? {
        id: top.id,
        label: top.label,
        detail: top.detail ?? null,
        href: normalizeOperatorReviewHref(top.href ?? aiOsUx.approveItemsHref),
      }
    : {
        id: "approvals",
        label: formatOperatorWaitingActivityLabel(aiOsUx.approveItemsCount),
        detail: null,
        href: normalizeOperatorReviewHref(aiOsUx.approveItemsHref),
      }

  const additionalDecisionCount = Math.max(0, totalWaiting - 1)

  return { primaryDecision, additionalDecisionCount, reviewAllHref: normalizeOperatorReviewHref(aiOsUx.approveItemsHref) }
}

function mapPrimaryDecision(result: {
  primaryDecision: GrowthHomeAvaHeroDecision | null
  additionalDecisionCount: number
  reviewAllHref: string | null
}) {
  return result
}

function resolveHeroEmployeeStatus(input: BuildAvaHomeHeroInput): GrowthHomeAiEmployeeStatus {
  const missionDiscovery = input.workspaceSummary?.missionDiscovery ?? null
  const missionStatus = resolveHomeOperatorEmployeeStatusFromMission({
    missionDiscovery,
    pendingApprovalCount: input.aiOsUx.approveItemsCount,
    repliesNeedingAttention: input.repliesWaiting,
    readyForOutreachReview: input.researchLoopSummary?.readyForOutreachReview ?? 0,
    portfolioBelowTarget:
      missionDiscovery?.lifecycleState === "finding_leads" ||
      missionDiscovery?.discoveryAction === "run_prospect_search" ||
      missionDiscovery?.discoveryAction === "refresh_audience"
        ? true
        : undefined,
  })
  return missionStatus ?? input.employeeStatus
}

export function buildAvaHomeHero(input: BuildAvaHomeHeroInput): GrowthHomeAvaHeroViewModel {
  const greeting = buildPersonalizedHomeGreeting({
    hour: input.hour,
    greeting: input.greeting,
    operatorDisplayName: input.operatorDisplayName,
  })
  const employeeStatus = resolveHeroEmployeeStatus(input)

  const legacyActivities = buildAvaCurrentActivities({
    employeeStatus,
    aiOsUx: input.aiOsUx,
    researchLoopSummary: input.researchLoopSummary,
    repliesWaiting: input.repliesWaiting,
  })
  const legacySinceLastVisit = buildAvaSinceLastVisit({
    researchLoopSummary: input.researchLoopSummary,
    accomplishments: input.accomplishments,
  })

  if (!input.workspaceSummary) {
    const legacyDecision = buildAvaPrimaryDecision(input.aiOsUx)
    return {
      qaMarker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
      greeting,
      statusLabel: employeeStatus.label,
      statusKind: employeeStatus.kind,
      currentActivities: legacyActivities,
      sinceLastVisit: legacySinceLastVisit,
      primaryDecision: legacyDecision.primaryDecision,
      additionalDecisionCount: legacyDecision.additionalDecisionCount,
      reviewAllHref: legacyDecision.reviewAllHref,
      allNormalLine: GROWTH_HOME_AVA_ALL_NORMAL_LINE,
      storyBlocks: [],
      briefingNarrative: [],
    }
  }

  const researchSnapshots = buildRelationshipLeadSnapshotsFromResearchLoop(input.researchLoopSummary)
  const serverSnapshots =
    input.relationshipSnapshotsById ?? input.workspaceSummary?.relationshipSnapshots?.byLeadId ?? {}
  const leadSnapshotsById = mergeRelationshipLeadSnapshotMaps(researchSnapshots, serverSnapshots)

  const dailyBriefing = buildAvaDailyBriefing({
    greeting,
    hour: input.hour,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou ?? input.aiOsUx.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue ?? input.aiOsUx.dailyWorkQueue,
    timeline: input.timeline ?? [],
    previousSnapshot: input.previousSnapshot ?? null,
    operatingRhythmMemory: input.operatingRhythmMemory ?? null,
    persistedMemoryStore: input.persistedMemoryStore ?? null,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    leadSnapshotsById,
    salesOutcomes: input.salesOutcomes ?? null,
    pendingApprovalCount: input.aiOsUx.approveItemsCount,
    organizationalKnowledge: input.organizationalKnowledge ?? null,
    portfolioLeads: input.workspaceSummary.portfolioLeads ?? null,
    canonicalAuthorityByLeadId:
      input.workspaceSummary.canonicalPortfolioAuthority?.authorityByLeadId ?? null,
  })

  assertDailyBriefing(dailyBriefing)

  const workManager = dailyBriefing.work_manager_result
  const canonicalHero = input.canonicalHeroDecision
  const canonicalTask = input.aiOsUx.canonicalOperatorTask
  const canonicalFocus = input.aiOsUx.canonicalOperatorFocus
  const decision = canonicalTask
    ? {
        primaryDecision: {
          id: canonicalTask.id,
          label: canonicalTask.title,
          detail: [canonicalTask.detail, canonicalTask.why].filter(Boolean).join(" · ") || null,
          href: normalizeOperatorReviewHref(
          canonicalTask.href ?? input.aiOsUx.approveItemsHref,
          canonicalTask.leadId,
        ),
          canonicalProjection: canonicalHero
            ? projectCanonicalDecisionToHomePrimary({
                decision: canonicalHero.decision,
                freshness: canonicalHero.freshness,
              }).projection
            : null,
        },
        additionalDecisionCount: Math.max(0, input.aiOsUx.approveItemsCount - 1),
        reviewAllHref: normalizeOperatorReviewHref(input.aiOsUx.approveItemsHref),
      }
    : canonicalHero
    ? (() => {
        const homePrimary = projectCanonicalDecisionToHomePrimary({
          decision: canonicalHero.decision,
          freshness: canonicalHero.freshness,
          href: buildGrowthLeadHref(canonicalHero.leadId),
        })
        return {
          primaryDecision: {
            id: homePrimary.id,
            label: homePrimary.label,
            detail: homePrimary.detail,
            href: homePrimary.href,
            canonicalProjection: homePrimary.projection,
          },
          additionalDecisionCount: Math.max(0, canonicalHero.decision.supportingActions.length),
          reviewAllHref: input.aiOsUx.approveItemsHref,
        }
      })()
    : canonicalFocus
      ? {
          primaryDecision: {
            id: `focus:${canonicalFocus.leadId}`,
            label: canonicalFocus.title,
            detail: canonicalFocus.detail,
            href: canonicalFocus.href,
            canonicalProjection: canonicalHero
              ? projectCanonicalDecisionToHomePrimary({
                  decision: canonicalHero.decision,
                  freshness: canonicalHero.freshness,
                }).projection
              : null,
          },
          additionalDecisionCount: 0,
          reviewAllHref: input.aiOsUx.approveItemsHref,
        }
      : workManager
      ? mapPrimaryDecision(buildPrimaryDecisionFromWorkManager(workManager, input.aiOsUx))
      : buildAvaPrimaryDecision(input.aiOsUx)

  const storyBlocks = dailyBriefing.story_blocks ?? []
  const dailyActivityNarrative = dailyBriefing.daily_activity_narrative ?? null
  const discoveryNarrativeTarget =
    input.workspaceSummary.missionDiscovery?.audienceName?.trim() ||
    input.workspaceSummary.missionDiscovery?.searchSummary?.trim() ||
    null

  const supervisedSalesProgress = projectSupervisedSalesProgressNarrative({
    approvalSnapshot: input.aiOsUx.canonicalApprovalSnapshot,
    missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
    researchLoopSummary: input.researchLoopSummary,
  })

  const recommendationExperience = buildGrowthHomeAvaRecommendationExperience({
    greeting,
    aiOsUx: input.aiOsUx,
    primaryDecision: decision.primaryDecision,
    canonicalOperatorTask: input.aiOsUx.canonicalOperatorTask,
    canonicalHeroDecision: input.canonicalHeroDecision ?? null,
    canonicalAuthorityByLeadId:
      input.workspaceSummary.canonicalPortfolioAuthority?.authorityByLeadId ?? null,
    canonicalOperatorFocus: input.aiOsUx.canonicalOperatorFocus,
    workManager,
    waitingOnYou: input.waitingOnYou ?? input.aiOsUx.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue ?? input.aiOsUx.dailyWorkQueue,
    missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
    supervisedSalesProgress,
    businessObjectiveLeadership: input.workspaceSummary.businessObjectiveLeadership ?? null,
  })

  const strategicLeadership = buildGrowthHomeAvaStrategicLeadershipPayload({
    businessObjectiveLeadership: input.workspaceSummary.businessObjectiveLeadership ?? null,
    missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
    strategicAdvisorContext: input.strategicAdvisorContext ?? null,
    salesOutcomes: input.salesOutcomes ?? null,
    recommendationExperience,
    pendingApprovals: input.aiOsUx.approveItemsCount,
    meetingsThisWeek: input.workspaceSummary.meetings?.thisWeek ?? 0,
    overrideRecords: input.overrideRecords ?? [],
  })

  const continuousExecutiveBriefing = input.executiveBriefingCursor
    ? buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
        greeting,
        hour: input.hour,
        cursor: input.executiveBriefingCursor,
        metricsSnapshot: dailyBriefing.metrics_snapshot,
        missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
        businessObjectiveLeadership: input.workspaceSummary.businessObjectiveLeadership ?? null,
        recommendationExperience,
        strategicLeadership,
        salesOutcomes: input.salesOutcomes ?? null,
        recommendationPreferences: input.recommendationPreferences ?? [],
        pendingApprovals: input.aiOsUx.approveItemsCount,
        outboundDisabled: input.outboundDisabled ?? true,
        outboundWaitingForBusinessHours: input.outboundWaitingForBusinessHours ?? false,
        generatedAt: input.generatedAt,
      })
    : null

  const executiveLanguage = enrichGrowthHomeExecutiveLanguageNext3c({
    reasoningInput: {
      evidenceCompleteness: input.organizationalEvidenceCompleteness ?? null,
      missionDiscovery: input.workspaceSummary.missionDiscovery ?? null,
      pendingApprovals: input.aiOsUx.approveItemsCount,
      outboundDisabled: input.outboundDisabled ?? true,
      businessObjectiveTitle:
        input.workspaceSummary.businessObjectiveLeadership?.primaryObjective?.title ?? null,
    },
    strategicLeadership,
    continuousExecutiveBriefing,
    recommendationExperience,
    businessObjectiveLeadership: input.workspaceSummary.businessObjectiveLeadership ?? null,
  })

  const accountability =
    input.recommendationAccountability ??
    buildGrowthHomeAvaRecommendationAccountabilityNext3d({
      organizationId: input.organizationId ?? input.persistedMemoryStore?.organizationId ?? "local-organization",
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      evidenceCompleteness: input.organizationalEvidenceCompleteness ?? null,
      executiveReasoning: executiveLanguage.executiveReasoning,
      memoryEvents: input.persistedMemoryStore?.events ?? [],
      recommendationPreferences: input.recommendationPreferences ?? [],
    })

  const executiveLanguageWithLearning = enrichGrowthHomeOrganizationalLearningNext3d({
    executiveLanguage,
    accountability,
  })

  const organizationalLearningCertification =
    input.organizationalLearningCertification ??
    buildGrowthOrganizationalLearningCertificationNext3e({
      organizationId: input.organizationId ?? input.persistedMemoryStore?.organizationId ?? "local-organization",
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      accountability,
      evidenceCompleteness: input.organizationalEvidenceCompleteness ?? null,
      baselineSnapshot:
        input.organizationalEffectivenessBaseline ??
        input.organizationalEvidenceCompleteness?.baselineSnapshot ??
        null,
      baselineEvidence: null,
      executiveReasoning: executiveLanguageWithLearning.executiveReasoning,
      memoryEvents: input.persistedMemoryStore?.events ?? [],
      outboundDisabled: input.outboundDisabled ?? true,
    })

  const executiveReasoning = enrichExecutiveReasoningWithLearningCertificationNext3e({
    reasoning: executiveLanguageWithLearning.executiveReasoning,
    certification: organizationalLearningCertification,
  })

  const enrichedRecommendationExperience = executiveLanguageWithLearning.recommendationExperience
    ? {
        ...executiveLanguageWithLearning.recommendationExperience,
        organizationalLearningLine:
          organizationalLearningCertification.organizationalLearningLine ??
          executiveLanguageWithLearning.recommendationExperience.organizationalLearningLine ??
          null,
      }
    : null

  return {
    qaMarker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
    greeting,
    statusLabel: employeeStatus.label,
    statusKind: employeeStatus.kind,
    currentActivities: legacyActivities,
    sinceLastVisit: legacySinceLastVisit,
    primaryDecision: decision.primaryDecision,
    additionalDecisionCount: decision.additionalDecisionCount,
    reviewAllHref: decision.reviewAllHref,
    allNormalLine: GROWTH_HOME_AVA_ALL_NORMAL_LINE,
    dailyBriefing,
    dailyActivityNarrative,
    storyBlocks,
    briefingNarrative: dailyActivityNarrative?.lines.map((row) => row.text) ?? storyBlocks.map((block) => block.text),
    workManager,
    operatingRhythm: dailyBriefing.operating_rhythm_result,
    memorySummary: dailyBriefing.memory_result,
    specialistOrchestrator: dailyBriefing.specialist_orchestrator_result ?? null,
    discoveryNarrativeTarget,
    supervisedSalesProgress,
    recommendationExperience: enrichedRecommendationExperience,
    businessObjectiveLeadership: executiveLanguageWithLearning.businessObjectiveLeadership
      ? {
          ...executiveLanguageWithLearning.businessObjectiveLeadership,
          organizationalLearningLine:
            organizationalLearningCertification.organizationalLearningLine ??
            executiveLanguageWithLearning.businessObjectiveLeadership.organizationalLearningLine ??
            null,
        }
      : null,
    strategicLeadership: executiveLanguageWithLearning.strategicLeadership,
    continuousExecutiveBriefing: executiveLanguageWithLearning.continuousExecutiveBriefing
      ? {
          ...executiveLanguageWithLearning.continuousExecutiveBriefing,
          organizationalLearningLines: organizationalLearningCertification.executiveReasoningLines.slice(0, 2),
        }
      : null,
    executiveReasoning,
    recommendationAccountability: executiveLanguageWithLearning.recommendationAccountability,
    organizationalLearningCertification,
  }
}

function assertDailyBriefing(briefing: AvaDailyBriefing): void {
  if (briefing.qaMarker !== GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER) {
    throw new Error("Invalid Ava daily briefing marker")
  }
}
