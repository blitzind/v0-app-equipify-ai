/**
 * GE-AIOS-NEXT-1A — Project Ava's existing ranked work into a Home recommendation queue.
 * Presentation-only — reuses canonical operator task, decision engine, work manager, and daily queue.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { GrowthCanonicalOperatorFocus } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import type { GrowthCanonicalOperatorTask } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthSupervisedSalesProgressNarrative } from "@/lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import {
  applyGrowthHomeAvaRecommendationPreferenceBoost,
  type GrowthHomeAvaRecommendationPreferenceRecord,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import { enrichGrowthHomeAvaRecommendationExperienceNext1b } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import { enrichGrowthHomeAvaRecommendationExperienceNext1d } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d"
import { enrichGrowthHomeAvaRecommendationExperienceNext1e } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e"
import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import {
  GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER,
  GROWTH_AIOS_NEXT_1A_EXHAUSTED_MESSAGE,
  GROWTH_AIOS_NEXT_1A_RECOMMENDATION_INTRO,
  GROWTH_AIOS_NEXT_1A_SINCE_LAST_VISIT_LINE,
  type GrowthHomeAvaRecommendationExperience,
  type GrowthHomeAvaRecommendationItem,
  type GrowthHomeAvaRecommendationKind,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF } from "@/lib/growth/navigation/growth-prospect-search-paths"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type {
  GrowthHomeAiOsUxViewModel,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthHomeAvaHeroDecision } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

const GROWTH_OBJECTIVES_WORKSPACE_HREF = "/growth/objectives" as const

function formatEffortLabel(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes === 1) return "1 minute"
  if (minutes < 60) return `${minutes} minutes`
  return `${Math.round((minutes / 60) * 10) / 10} hours`
}

function buildResearchProgressLine(input: {
  confidencePercent?: number | null
  detail?: string | null
}): string | null {
  const percent = input.confidencePercent
  if (typeof percent === "number" && percent > 0 && percent < 100) {
    return `Research is already ${Math.round(percent)}% complete.`
  }
  if (input.detail && /research|qualif|progress|complete/i.test(input.detail)) {
    return input.detail
  }
  return null
}

function buildOutcomeLine(kind: GrowthHomeAvaRecommendationKind, detail: string | null): string | null {
  if (kind === "approval_package") {
    return "Reviewing this package unlocks outreach once you authorize it."
  }
  if (kind === "mission_discovery") {
    return detail
  }
  if (kind === "lead_decision" || kind === "operator_focus" || kind === "work_manager") {
    return detail && detail !== "Finishing it will prepare the account for outreach."
      ? detail
      : "Finishing it will prepare the account for outreach."
  }
  if (kind === "daily_queue") {
    return detail
  }
  if (kind === "supervised_sales") {
    return detail
  }
  return detail
}

function dedupeRecommendations(items: GrowthHomeAvaRecommendationItem[]): GrowthHomeAvaRecommendationItem[] {
  const seen = new Set<string>()
  const output: GrowthHomeAvaRecommendationItem[] = []
  for (const item of items.sort((left, right) => left.rank - right.rank)) {
    const key = item.leadId ? `${item.kind}:${item.leadId}` : item.id
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }
  return output.map((item, index) => ({ ...item, rank: index + 1 }))
}

function pushRecommendation(
  bucket: GrowthHomeAvaRecommendationItem[],
  item: Omit<GrowthHomeAvaRecommendationItem, "rank"> & { rank?: number },
): void {
  bucket.push({
    ...item,
    rank: item.rank ?? bucket.length + 1,
  })
}

export type BuildGrowthHomeAvaRecommendationExperienceInput = {
  greeting: string
  aiOsUx: GrowthHomeAiOsUxViewModel
  primaryDecision: GrowthHomeAvaHeroDecision | null
  canonicalOperatorTask?: GrowthCanonicalOperatorTask | null
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
  canonicalOperatorFocus?: GrowthCanonicalOperatorFocus | null
  workManager?: AvaWorkManagerResult | null
  waitingOnYou?: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue?: GrowthHomeDailyWorkQueueItem[]
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  supervisedSalesProgress?: GrowthSupervisedSalesProgressNarrative | null
  preferenceRecords?: GrowthHomeAvaRecommendationPreferenceRecord[]
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
}

export function buildGrowthHomeAvaRecommendationExperience(
  input: BuildGrowthHomeAvaRecommendationExperienceInput,
): GrowthHomeAvaRecommendationExperience {
  const recommendations: GrowthHomeAvaRecommendationItem[] = []
  const waitingOnYou = input.waitingOnYou ?? input.aiOsUx.waitingOnYou
  const dailyWorkQueue = input.dailyWorkQueue ?? input.aiOsUx.dailyWorkQueue

  const canonicalTask = input.canonicalOperatorTask ?? input.aiOsUx.canonicalOperatorTask ?? null
  if (canonicalTask) {
    pushRecommendation(recommendations, {
      id: canonicalTask.id,
      kind: "approval_package",
      title: canonicalTask.title,
      headline: canonicalTask.title,
      detail: canonicalTask.detail || null,
      supportingLine: canonicalTask.why || null,
      outcomeLine: canonicalTask.whatHappensNext || buildOutcomeLine("approval_package", null),
      estimatedMinutes: canonicalTask.draftCount ? Math.max(3, canonicalTask.draftCount * 2) : 3,
      estimatedEffortLabel: formatEffortLabel(canonicalTask.draftCount ? Math.max(3, canonicalTask.draftCount * 2) : 3),
      href: canonicalTask.href,
      leadId: canonicalTask.leadId,
      companyName: canonicalTask.companyName,
      whyReasons: [canonicalTask.why, canonicalTask.whatHappensNext].filter(Boolean),
      sourceLabel: "canonical_operator_task",
    })
  }

  const heroDecision = input.canonicalHeroDecision
  if (heroDecision?.decision) {
    const projection = projectGrowthCanonicalOperatorDecision({
      decision: heroDecision.decision,
      freshness: heroDecision.freshness,
    })
    pushRecommendation(recommendations, {
      id: `decision:${heroDecision.decision.decisionFingerprint}`,
      kind: "lead_decision",
      title: projection.whatToDo,
      headline: projection.whatToDo,
      detail: projection.why[0] ?? null,
      supportingLine: buildResearchProgressLine({
        detail: projection.why[0] ?? null,
      }),
      outcomeLine: projection.thenActions[0] ?? buildOutcomeLine("lead_decision", projection.why[0] ?? null),
      estimatedMinutes: 5,
      estimatedEffortLabel: "3–5 minutes",
      href: input.primaryDecision?.href ?? buildGrowthLeadHref(heroDecision.leadId),
      leadId: heroDecision.leadId,
      companyName: heroDecision.companyName,
      whyReasons: projection.why,
      sourceLabel: "canonical_decision_engine",
    })

    for (const [index, action] of heroDecision.decision.supportingActions.entries()) {
      pushRecommendation(recommendations, {
        id: `decision-support:${heroDecision.decision.decisionFingerprint}:${index}`,
        kind: "lead_decision",
        title: action.title,
        headline: action.title,
        detail: action.rationale,
        supportingLine: action.rationale,
        outcomeLine: buildOutcomeLine("lead_decision", action.rationale),
        estimatedMinutes: 5,
        estimatedEffortLabel: "3–5 minutes",
        href: buildGrowthLeadHref(heroDecision.leadId),
        leadId: heroDecision.leadId,
        companyName: heroDecision.companyName,
        whyReasons: [action.rationale],
        sourceLabel: "canonical_decision_supporting_action",
      })
    }
  }

  const focus = input.canonicalOperatorFocus ?? input.aiOsUx.canonicalOperatorFocus ?? null
  if (focus) {
    pushRecommendation(recommendations, {
      id: `focus:${focus.leadId}`,
      kind: "operator_focus",
      title: focus.title,
      headline: focus.title,
      detail: focus.detail,
      supportingLine: focus.detail,
      outcomeLine: buildOutcomeLine("operator_focus", focus.detail),
      estimatedMinutes: 5,
      estimatedEffortLabel: "3–5 minutes",
      href: focus.href,
      leadId: focus.leadId,
      companyName: focus.companyName,
      whyReasons: focus.detail ? [focus.detail] : [],
      sourceLabel: "canonical_operator_focus",
    })
  }

  const workManager = input.workManager
  if (workManager) {
    for (const [index, row] of workManager.operator_queue.entries()) {
      if (row.type === "approval" && canonicalTask) continue
      pushRecommendation(recommendations, {
        id: row.id,
        kind: "work_manager",
        title: row.title,
        headline: row.title,
        detail: row.description,
        supportingLine: row.routing_reason ?? row.description,
        outcomeLine: row.next_action ?? buildOutcomeLine("work_manager", row.description),
        estimatedMinutes: row.estimated_minutes,
        estimatedEffortLabel: formatEffortLabel(row.estimated_minutes),
        href: row.href,
        leadId: null,
        companyName: row.company_name,
        whyReasons: [row.routing_reason, row.description].filter(Boolean) as string[],
        sourceLabel: `work_manager_operator_queue:${index}`,
      })
    }
  }

  for (const [index, row] of waitingOnYou.entries()) {
    if (canonicalTask && row.id.startsWith("approval:")) continue
    pushRecommendation(recommendations, {
      id: row.id,
      kind: "waiting_on_you",
      title: row.label,
      headline: row.label,
      detail: row.detail ?? null,
      supportingLine: row.detail ?? null,
      outcomeLine: buildOutcomeLine("waiting_on_you", row.detail ?? null),
      estimatedMinutes: 3,
      estimatedEffortLabel: "3 minutes",
      href: row.href ?? input.aiOsUx.approveItemsHref,
      leadId: null,
      companyName: null,
      whyReasons: row.detail ? [row.detail] : [],
      sourceLabel: `waiting_on_you:${index}`,
    })
  }

  for (const [index, row] of dailyWorkQueue.entries()) {
    pushRecommendation(recommendations, {
      id: row.id,
      kind: "daily_queue",
      title: `${row.companyName} — ${row.actionLabel}`,
      headline: row.actionLabel,
      detail: row.reason ?? null,
      supportingLine: buildResearchProgressLine({
        confidencePercent: row.confidencePercent,
        detail: row.reason ?? null,
      }),
      outcomeLine: row.reason ?? buildOutcomeLine("daily_queue", row.reason ?? null),
      estimatedMinutes: row.estimatedMinutes,
      estimatedEffortLabel: formatEffortLabel(row.estimatedMinutes),
      href: row.href,
      leadId: null,
      companyName: row.companyName,
      whyReasons: row.reason ? [row.reason] : [],
      sourceLabel: `daily_revenue_work_queue:${index}`,
    })
  }

  const supervised = input.supervisedSalesProgress
  if (supervised?.href && supervised.ctaLabel && !supervised.headlineSuppressed) {
    pushRecommendation(recommendations, {
      id: "supervised-sales-progress",
      kind: "supervised_sales",
      title: supervised.headline,
      headline: supervised.headline,
      detail: supervised.supportingSentence ?? supervised.secondaryContext,
      supportingLine: supervised.supportingSentence ?? supervised.secondaryContext,
      outcomeLine: supervised.secondaryContext ?? supervised.supportingSentence,
      estimatedMinutes: 3,
      estimatedEffortLabel: "3 minutes",
      href: supervised.href,
      leadId: null,
      companyName: null,
      whyReasons: [supervised.supportingSentence, supervised.secondaryContext].filter(Boolean) as string[],
      sourceLabel: "supervised_sales_progress",
    })
  }

  const missionDiscovery = input.missionDiscovery
  if (missionDiscovery?.discoveryAction === "run_prospect_search" || missionDiscovery?.pipelineLow) {
    const audience = missionDiscovery.audienceName ?? missionDiscovery.searchSummary ?? "your target market"
    pushRecommendation(recommendations, {
      id: "mission-discovery-find-leads",
      kind: "mission_discovery",
      title: `Find more companies in ${audience}`,
      headline: `Find more companies in ${audience}`,
      detail: missionDiscovery.lastEventSummary,
      supportingLine: missionDiscovery.activityLabel,
      outcomeLine: "Adding qualified companies keeps your pipeline healthy for outreach.",
      estimatedMinutes: 10,
      estimatedEffortLabel: "10–15 minutes",
      href: GROWTH_WORKSPACE_PROSPECT_SEARCH_DISCOVER_HREF,
      leadId: null,
      companyName: null,
      whyReasons: [
        missionDiscovery.activityLabel,
        missionDiscovery.lastEventSummary,
        missionDiscovery.pipelineLow ? "Pipeline is running low on fresh companies." : "",
      ].filter(Boolean),
      sourceLabel: "mission_discovery_snapshot",
    })
  } else if (missionDiscovery?.researchingCount && missionDiscovery.researchingCount > 0) {
    pushRecommendation(recommendations, {
      id: "mission-discovery-research",
      kind: "mission_discovery",
      title: `Continue researching ${missionDiscovery.researchingCount} companies`,
      headline: `Continue researching ${missionDiscovery.researchingCount} companies`,
      detail: missionDiscovery.lastEventSummary,
      supportingLine: missionDiscovery.activityLabel,
      outcomeLine: "Finishing research prepares more accounts for outreach review.",
      estimatedMinutes: 8,
      estimatedEffortLabel: "5–10 minutes",
      href: GROWTH_OBJECTIVES_WORKSPACE_HREF,
      leadId: null,
      companyName: null,
      whyReasons: [missionDiscovery.activityLabel, missionDiscovery.lastEventSummary].filter(Boolean) as string[],
      sourceLabel: "mission_discovery_researching",
    })
  }

  const deduped = dedupeRecommendations(recommendations)
  const ranked = applyGrowthHomeAvaRecommendationPreferenceBoost(
    deduped,
    input.preferenceRecords ?? [],
  )

  return enrichGrowthHomeAvaRecommendationExperienceNext1e({
    experience: enrichGrowthHomeAvaRecommendationExperienceNext1d({
      experience: enrichGrowthHomeAvaRecommendationExperienceNext1b({
        experience: {
          qaMarker: GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER,
          openingLine: input.greeting,
          sinceLastVisitLine: GROWTH_AIOS_NEXT_1A_SINCE_LAST_VISIT_LINE,
          recommendationIntro: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_INTRO,
          recommendations: ranked,
          hasRecommendations: ranked.length > 0,
          exhaustedMessage: GROWTH_AIOS_NEXT_1A_EXHAUSTED_MESSAGE,
        },
        canonicalHeroDecision: input.canonicalHeroDecision ?? null,
      }),
      canonicalHeroDecision: input.canonicalHeroDecision ?? null,
      missionDiscovery: input.missionDiscovery ?? null,
    }),
    businessObjectiveLeadership: input.businessObjectiveLeadership ?? null,
  })
}
