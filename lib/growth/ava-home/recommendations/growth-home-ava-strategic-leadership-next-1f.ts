/**
 * GE-AIOS-NEXT-1F — Strategic Leadership synthesizer (presentation-only).
 * Combines existing objective, mission, sales, and memory signals — no new strategy engine.
 */

import type { GrowthHomeAvaBusinessObjectiveLeadershipPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import type { GrowthHomeAvaStrategicAdvisorContextPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import type { GrowthHomeAvaStrategicOverrideRecord } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthHomeAvaRecommendationExperience } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { AvaOrganizationalPreference } from "@/lib/growth/memory/types"
import {
  GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE,
  GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER,
  type GrowthHomeAvaStrategicInsight,
  type GrowthHomeAvaStrategicInsightKind,
  type GrowthHomeAvaStrategicLeadershipPayload,
  type GrowthHomeAvaStrategicRecommendation,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"

const GROWTH_OBJECTIVES_WORKSPACE_HREF = "/growth/objectives" as const

type Candidate = {
  score: number
  insight: GrowthHomeAvaStrategicInsight
  recommendation: GrowthHomeAvaStrategicRecommendation | null
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function buildStrategicMemoryLine(input: {
  preferences: AvaOrganizationalPreference[]
  overrideRecords: GrowthHomeAvaStrategicOverrideRecord[]
}): string | null {
  const topOverride = [...input.overrideRecords].sort((a, b) => b.overrideCount - a.overrideCount)[0]
  if (topOverride && topOverride.overrideCount >= 3) {
    return `I've noticed you've consistently redirected me toward ${topOverride.instruction.toLowerCase()}.`
  }
  const preference = input.preferences[0]
  if (preference?.statement) return preference.statement
  return null
}

function buildRecentWins(input: {
  salesOutcomes: GrowthHomeSalesOutcomesPayload | null
  recommendationExperience: GrowthHomeAvaRecommendationExperience | null
}): string[] {
  const summary = input.salesOutcomes?.dailySummary
  const wins = uniqueStrings([
    summary && summary.strong_opportunities > 0
      ? `${summary.strong_opportunities} strong ${summary.strong_opportunities === 1 ? "opportunity" : "opportunities"} identified today`
      : null,
    summary && summary.researched > 0
      ? `${summary.researched} ${summary.researched === 1 ? "company" : "companies"} researched`
      : null,
    summary && summary.outreach_prepared > 0
      ? `${summary.outreach_prepared} outreach ${summary.outreach_prepared === 1 ? "package" : "packages"} prepared`
      : null,
    summary && summary.meetings_prepared > 0
      ? `${summary.meetings_prepared} meeting ${summary.meetings_prepared === 1 ? "prep" : "preps"} completed`
      : null,
  ])
  if (wins.length > 0) return wins.slice(0, 4)
  const top = input.recommendationExperience?.recommendations[0]
  if (top?.outcomeProjection?.expectedOutcome) return [top.outcomeProjection.expectedOutcome]
  return []
}

function buildWhatsNext(input: {
  recommendationExperience: GrowthHomeAvaRecommendationExperience | null
}): string[] {
  const top = input.recommendationExperience?.recommendations[0]
  if (!top) return []
  return uniqueStrings([
    top.outcomeProjection?.nextStepLabel,
    ...(top.executionPathSteps ?? []).slice(0, 3),
  ]).slice(0, 4)
}

function buildRecommendationBase(input: {
  headline: string
  summary: string
  recommendedFocusShift: string
  insight: GrowthHomeAvaStrategicInsight
  expectedImpact: string
  potentialRisks: string[]
  whatWouldChange: string[]
  whatRemainsTheSame: string[]
  estimatedBenefit: string | null
  recommendedObjectiveLabel: string | null
}): GrowthHomeAvaStrategicRecommendation {
  return {
    headline: input.headline,
    summary: input.summary,
    recommendedFocusShift: input.recommendedFocusShift,
    whatObserved: [input.insight.observation],
    whyItMatters: input.insight.whyItMatters,
    supportingEvidence: input.insight.evidenceSources,
    confidence: input.insight.confidence,
    confidenceReason: input.insight.confidenceReason,
    expectedImpact: input.expectedImpact,
    potentialRisks: input.potentialRisks,
    whatWouldChange: input.whatWouldChange,
    whatRemainsTheSame: input.whatRemainsTheSame,
    estimatedBenefit: input.estimatedBenefit,
    recommendedObjectiveLabel: input.recommendedObjectiveLabel,
    objectivesReviewHref: GROWTH_OBJECTIVES_WORKSPACE_HREF,
  }
}

export function buildGrowthHomeAvaStrategicLeadershipPayload(input: {
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  strategicAdvisorContext?: GrowthHomeAvaStrategicAdvisorContextPayload | null
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  recommendationExperience?: GrowthHomeAvaRecommendationExperience | null
  pendingApprovals?: number
  meetingsThisWeek?: number
  overrideRecords?: GrowthHomeAvaStrategicOverrideRecord[]
  organizationPreferences?: AvaOrganizationalPreference[]
}): GrowthHomeAvaStrategicLeadershipPayload {
  const primary = input.businessObjectiveLeadership?.primaryObjective ?? null
  const mission = input.missionDiscovery ?? null
  const pendingApprovals = input.pendingApprovals ?? mission?.counters.pendingApprovals ?? 0
  const preferences =
    input.organizationPreferences ?? input.strategicAdvisorContext?.organizationPreferences ?? []
  const overrideRecords = input.overrideRecords ?? []
  const strategicMemoryLine = buildStrategicMemoryLine({ preferences, overrideRecords })
  const knowledgeFindings =
    input.strategicAdvisorContext?.organizationalKnowledge
      ?.filter((item) => item.active && !item.superseded_by && item.confidence >= 0.65)
      .map((item) => item.finding)
      .slice(0, 2) ?? []

  const candidates: Candidate[] = []

  const topOverride = [...overrideRecords].sort((a, b) => b.overrideCount - a.overrideCount)[0]
  if (topOverride && topOverride.overrideCount >= 3) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "operator_override_pattern",
      observation: `You've redirected me toward the same market direction ${topOverride.overrideCount} times recently.`,
      whyItMatters:
        "Repeated operator direction may reveal a stronger opportunity than our current approved strategy reflects.",
      evidenceSources: uniqueStrings(["operator_override_history", "organization_preferences"]),
      confidence: topOverride.overrideCount >= 5 ? "high" : "moderate",
      confidenceReason:
        topOverride.overrideCount >= 5
          ? "The override pattern is consistent across multiple requests."
          : "The pattern is emerging — I'd like your judgment before changing formal strategy.",
      strategicMemoryLine,
    }
    candidates.push({
      score: 90 + topOverride.overrideCount,
      insight,
      recommendation: buildRecommendationBase({
        headline: "I think it's time we reconsider our approved strategy.",
        summary:
          "I would not change strategy myself. Based on your repeated direction, I recommend we formally evaluate expanding our approved focus.",
        recommendedFocusShift: `Evaluate adopting ${topOverride.instruction.trim()} as a formal strategic priority.`,
        insight,
        expectedImpact: "Aligns formal strategy with the markets you keep steering us toward.",
        potentialRisks: ["Expanding focus too quickly can dilute current pipeline momentum."],
        whatWouldChange: ["Primary business objective emphasis", "Discovery audience weighting"],
        whatRemainsTheSame: ["Approval-gated outreach", "Existing qualified pipeline", "Business Profile authority"],
        estimatedBenefit: "Higher qualification rates in markets you've already chosen to explore.",
        recommendedObjectiveLabel: null,
      }),
    })
  }

  if (primary?.completed && primary.nextObjectiveTitle) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "objective_complete",
      observation: "We achieved our current business objective.",
      whyItMatters: "Completing an objective is a natural moment to shift executive focus.",
      evidenceSources: uniqueStrings(["primary_business_objective", "objective_progress"]),
      confidence: "high",
      confidenceReason: "The objective target has been reached with existing objective authority.",
      strategicMemoryLine,
    }
    candidates.push({
      score: 85,
      insight,
      recommendation: buildRecommendationBase({
        headline: "I'd like to recommend our next business objective.",
        summary: `We've finished ${primary.title.toLowerCase()}. I recommend we begin ${primary.nextObjectiveTitle.toLowerCase()}.`,
        recommendedFocusShift: primary.nextObjectiveTitle,
        insight,
        expectedImpact: "Maintains revenue momentum without losing focus between objectives.",
        potentialRisks: ["Switching focus too quickly before stabilizing outreach results."],
        whatWouldChange: ["Primary business objective", "Today's recommendation emphasis"],
        whatRemainsTheSame: ["Qualified pipeline", "Approval workflow", "Business Profile"],
        estimatedBenefit: "Clear executive focus on the next highest-value outcome.",
        recommendedObjectiveLabel: primary.nextObjectiveTitle,
      }),
    })
  }

  if (primary?.health === "ahead") {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "objective_ahead",
      observation: `This week's objective will likely finish ahead of schedule (${primary.progressLabel}).`,
      whyItMatters: "Finishing early creates room to raise the bar or shift focus to the next bottleneck.",
      evidenceSources: uniqueStrings(["primary_business_objective", "objective_forecast"]),
      confidence: "moderate",
      confidenceReason: "Progress is ahead of target, but downstream conversion still needs monitoring.",
      strategicMemoryLine,
    }
    candidates.push({ score: 70, insight, recommendation: null })
  }

  if (pendingApprovals >= 2) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "approval_bottleneck",
      observation: `Outreach approvals are becoming a bottleneck (${pendingApprovals} packages waiting for you).`,
      whyItMatters: "Prepared opportunities cannot convert while approval waits.",
      evidenceSources: uniqueStrings(["canonical_operator_approval", "sales_outcomes"]),
      confidence: pendingApprovals >= 3 ? "high" : "moderate",
      confidenceReason:
        pendingApprovals >= 3
          ? "Multiple packages are ready and outreach is paused behind approval."
          : "Approval delay is visible, but volume is still manageable.",
      strategicMemoryLine,
    }
    candidates.push({
      score: 78 + pendingApprovals,
      insight,
      recommendation: buildRecommendationBase({
        headline: "I'd like to recommend shifting focus toward outreach execution.",
        summary:
          "We've built qualified opportunities. The biggest opportunity now is converting them into conversations.",
        recommendedFocusShift: "Shift primary focus from discovery toward outreach execution.",
        insight,
        expectedImpact: "Unlocks conversations with qualified opportunities already prepared.",
        potentialRisks: ["Discovery momentum slows if we deprioritize new company intake."],
        whatWouldChange: ["Today's recommendation emphasis", "Operator attention on approvals"],
        whatRemainsTheSame: ["Current business objective target", "Discovery audience", "ICP authority"],
        estimatedBenefit: "Faster movement from qualified package to live conversation.",
        recommendedObjectiveLabel: "Increase qualified meetings",
      }),
    })
  }

  const researchingCount = mission?.counters.researchingCount ?? 0
  if (researchingCount >= 5 && pendingApprovals === 0) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "research_bottleneck",
      observation: `Research throughput has become the bottleneck (${researchingCount} companies still in research).`,
      whyItMatters: "Packages cannot be prepared until research completes.",
      evidenceSources: uniqueStrings(["mission_discovery_counters", "mission_runtime"]),
      confidence: "moderate",
      confidenceReason: "Research queue depth is visible, but completion rate still needs validation.",
      strategicMemoryLine,
    }
    candidates.push({ score: 72, insight, recommendation: null })
  }

  if (mission && !mission.pipelineLow && mission.leadPoolVisible >= 30 && pendingApprovals > 0) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "shift_to_outreach",
      observation: "Pipeline coverage looks healthy while outreach execution is waiting on approval.",
      whyItMatters: "Healthy pipeline coverage reduces the urgency of new discovery.",
      evidenceSources: uniqueStrings(["mission_discovery", "lead_pool", "operator_approval"]),
      confidence: "moderate",
      confidenceReason: "Coverage and approval signals align, but conversion evidence is still limited.",
      strategicMemoryLine,
    }
    candidates.push({
      score: 75,
      insight,
      recommendation: buildRecommendationBase({
        headline: "I'd like to recommend a change in focus.",
        summary:
          "We've achieved healthy pipeline coverage. Based on our current progress, I believe our biggest opportunity is converting qualified opportunities into conversations.",
        recommendedFocusShift: "Shift primary focus from discovery toward outreach execution.",
        insight,
        expectedImpact: "Turns qualified pipeline into conversations while coverage remains strong.",
        potentialRisks: ["Discovery cadence slows if outreach does not convert."],
        whatWouldChange: ["Executive priority on approvals and send readiness"],
        whatRemainsTheSame: ["Approved Business Profile", "Current objective target", "Qualified companies"],
        estimatedBenefit: "Better utilization of the pipeline we've already built.",
        recommendedObjectiveLabel: "Increase qualified meetings",
      }),
    })
  }

  if (mission?.pipelineLow) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "shift_to_discovery",
      observation: "Current portfolio coverage is running low on fresh qualified companies.",
      whyItMatters: "Outreach cannot scale without replenishment.",
      evidenceSources: uniqueStrings(["mission_discovery", "lead_pool", "portfolio_manager"]),
      confidence: "high",
      confidenceReason: "Pipeline-low signal is already part of mission discovery authority.",
      strategicMemoryLine,
    }
    candidates.push({
      score: 80,
      insight,
      recommendation: buildRecommendationBase({
        headline: "I'd like to recommend refocusing on discovery.",
        summary:
          "Pipeline coverage needs replenishment before we can sustainably increase outreach volume.",
        recommendedFocusShift: "Shift primary focus toward expanding qualified pipeline coverage.",
        insight,
        expectedImpact: "Restores healthy pipeline coverage for sustained outreach.",
        potentialRisks: ["Short-term outreach volume may flatten while discovery catches up."],
        whatWouldChange: ["Primary recommendation emphasis on discovery"],
        whatRemainsTheSame: ["Outreach approval workflow", "Existing qualified accounts"],
        estimatedBenefit: "Healthier top-of-funnel coverage within approved markets.",
        recommendedObjectiveLabel: "Expand qualified pipeline",
      }),
    })
  }

  if (mission?.pipelineLow === false && mission.leadPoolVisible >= 50) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "portfolio_quality",
      observation: "Pipeline quality and coverage have improved significantly.",
      whyItMatters: "Strong coverage creates optionality for conversion-focused work.",
      evidenceSources: uniqueStrings(["lead_pool", "mission_discovery"]),
      confidence: "moderate",
      confidenceReason: "Coverage is healthy; conversion performance should confirm the next move.",
      strategicMemoryLine,
    }
    candidates.push({ score: 55, insight, recommendation: null })
  }

  if (knowledgeFindings[0]) {
    const insight: GrowthHomeAvaStrategicInsight = {
      kind: "organizational_learning",
      observation: knowledgeFindings[0],
      whyItMatters: "Validated organizational learning should inform executive focus.",
      evidenceSources: uniqueStrings(["organizational_knowledge", ...knowledgeFindings.slice(0, 2)]),
      confidence: "moderate",
      confidenceReason: "This comes from validated organizational knowledge, not a single anecdote.",
      strategicMemoryLine,
    }
    candidates.push({ score: 50, insight, recommendation: null })
  }

  const winner = [...candidates].sort((left, right) => right.score - left.score)[0] ?? null
  const hasInsight = Boolean(winner && winner.score >= 55)

  return {
    qaMarker: GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER,
    leadershipPrinciple: GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE,
    hasInsight,
    title: "Strategic Insight",
    subtitle: "I've noticed something important...",
    insight: hasInsight ? winner!.insight : null,
    recommendation: hasInsight ? winner!.recommendation : null,
    recentWins: buildRecentWins({
      salesOutcomes: input.salesOutcomes ?? null,
      recommendationExperience: input.recommendationExperience ?? null,
    }),
    whatsNext: buildWhatsNext({
      recommendationExperience: input.recommendationExperience ?? null,
    }),
  }
}

export function enrichGrowthHomeAvaStrategicLeadershipWithClientSignals(input: {
  payload: GrowthHomeAvaStrategicLeadershipPayload
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  strategicAdvisorContext?: GrowthHomeAvaStrategicAdvisorContextPayload | null
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  recommendationExperience?: GrowthHomeAvaRecommendationExperience | null
  pendingApprovals?: number
  overrideRecords?: GrowthHomeAvaStrategicOverrideRecord[]
}): GrowthHomeAvaStrategicLeadershipPayload {
  if (!input.overrideRecords?.length) return input.payload
  return buildGrowthHomeAvaStrategicLeadershipPayload({
    businessObjectiveLeadership: input.businessObjectiveLeadership,
    missionDiscovery: input.missionDiscovery,
    strategicAdvisorContext: input.strategicAdvisorContext,
    salesOutcomes: input.salesOutcomes,
    recommendationExperience: input.recommendationExperience,
    pendingApprovals: input.pendingApprovals,
    overrideRecords: input.overrideRecords,
  })
}
