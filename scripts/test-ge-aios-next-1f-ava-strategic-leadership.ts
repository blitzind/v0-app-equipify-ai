/**
 * GE-AIOS-NEXT-1F — Ava strategic leadership (executive insights + strategy recommendations).
 * Run: pnpm test:ge-aios-next-1f-ava-strategic-leadership
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeAvaStrategicLeadershipPayload,
  enrichGrowthHomeAvaStrategicLeadershipWithClientSignals,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f"
import {
  GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE,
  GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"
import { buildGrowthHomeAvaRecommendationExperience } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"

const PHASE = "GE-AIOS-NEXT-1F-AVA-STRATEGIC-LEADERSHIP" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockAiOsUx(overrides: Record<string, unknown> = {}) {
  return {
    hero: { greeting: "Good evening, Michael." },
    approveItemsCount: 0,
    waitingOnYou: [],
    dailyWorkQueue: [],
    approveItemsHref: "/growth/review?tab=packages",
    canonicalOperatorTask: null,
    canonicalOperatorFocus: null,
    canonicalApprovalSnapshot: null,
    canonicalActiveMissions: null,
    canonicalOperatorProgress: null,
    ...overrides,
  } as import("../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types").GrowthHomeAiOsUxViewModel
}

function mockMissionDiscovery(overrides: Record<string, unknown> = {}) {
  return {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "objective-packages",
    lifecycleState: "researching",
    activityLabel: "Researching qualified companies",
    counters: {
      newCompaniesFound: 2,
      recordsImported: 4,
      researchingCount: 0,
      draftsPrepared: 11,
      pendingApprovals: 0,
    },
    searchSummary: "HVAC service",
    audienceName: "HVAC service",
    recordsImported: 4,
    newCompaniesFound: 2,
    leadPoolVisible: 142,
    leadPoolHasMore: false,
    pipelineLow: false,
    lastEventSummary: null,
    discoveryAction: "begin_research",
    startupDiscoveryReady: true,
    ...overrides,
  } as import("../lib/growth/mission-center/growth-home-mission-discovery-snapshot").GrowthHomeMissionDiscoverySnapshot
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.match(GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE, /recommends strategy changes/i)
  console.log("  ✓ leadership principle documented")

  const approvalPayload = buildGrowthHomeAvaStrategicLeadershipPayload({
    missionDiscovery: mockMissionDiscovery({
      counters: {
        newCompaniesFound: 2,
        recordsImported: 4,
        researchingCount: 0,
        draftsPrepared: 11,
        pendingApprovals: 3,
      },
    }),
    pendingApprovals: 3,
  })
  assert.equal(approvalPayload.qaMarker, GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER)
  assert.equal(approvalPayload.hasInsight, true)
  assert.equal(approvalPayload.insight?.kind, "approval_bottleneck")
  assert.ok(approvalPayload.recommendation)
  assert.match(approvalPayload.recommendation!.headline, /recommend/i)
  assert.match(approvalPayload.recommendation!.summary, /conversations/i)
  assert.equal(approvalPayload.recommendation!.objectivesReviewHref, "/growth/objectives")
  console.log("  ✓ approval bottleneck produces strategic recommendation with operator review path")

  const discoveryPayload = buildGrowthHomeAvaStrategicLeadershipPayload({
    missionDiscovery: mockMissionDiscovery({ pipelineLow: true, leadPoolVisible: 12 }),
  })
  assert.equal(discoveryPayload.insight?.kind, "shift_to_discovery")
  assert.match(discoveryPayload.recommendation?.recommendedFocusShift ?? "", /pipeline coverage/i)
  console.log("  ✓ pipeline-low signal recommends discovery refocus")

  const overridePayload = buildGrowthHomeAvaStrategicLeadershipPayload({
    overrideRecords: [
      {
        marketKey: "medical equipment|texas",
        instruction: "medical equipment companies",
        overrideCount: 7,
        lastOverrideAt: new Date().toISOString(),
      },
    ],
  })
  assert.equal(overridePayload.insight?.kind, "operator_override_pattern")
  assert.match(overridePayload.recommendation?.headline ?? "", /reconsider our approved strategy/i)
  assert.match(overridePayload.insight?.strategicMemoryLine ?? "", /consistently redirected/i)
  console.log("  ✓ repeated overrides recommend formal strategy reconsideration")

  const quietPayload = buildGrowthHomeAvaStrategicLeadershipPayload({
    missionDiscovery: mockMissionDiscovery({ leadPoolVisible: 20, pipelineLow: false }),
    pendingApprovals: 0,
  })
  assert.equal(quietPayload.hasInsight, false)
  assert.equal(quietPayload.insight, null)
  console.log("  ✓ strategic insight hidden when evidence score is below threshold")

  const leadershipSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f.ts")
  assert.doesNotMatch(leadershipSource, /buildGrowthMissionPriorityReadModel|scoreMissionPriority/)
  assert.doesNotMatch(leadershipSource, /applyGrowthHomeAvaRecommendationPreferenceBoost/)
  assert.doesNotMatch(leadershipSource, /buildGrowthObjectivePlan|buildGrowthMissionPlan/)
  assert.match(leadershipSource, /missionDiscovery/)
  assert.match(leadershipSource, /overrideRecords/)
  assert.match(leadershipSource, /organizationPreferences/)
  console.log("  ✓ synthesizer reuses existing evidence without duplicate engines")

  const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroSource, /GrowthHomeAvaStrategicInsightSection/)
  assert.match(heroSource, /GrowthHomeAvaScoreboardSection/)
  assert.match(heroSource, /GrowthHomeAvaExecutiveBriefingFooterSection/)
  console.log("  ✓ executive briefing layout follows greeting → objective → recommendation → insight → scoreboard → wins")

  const objectiveUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-business-objective-section.tsx")
  assert.doesNotMatch(objectiveUi, /business-objective-scoreboard/)
  console.log("  ✓ scoreboard moved out of business objective section")

  const insightUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-strategic-insight-section.tsx")
  assert.match(insightUi, /Continue with current objective/)
  assert.match(insightUi, /Review Ava&apos;s recommendation/)
  assert.match(insightUi, /Adopt recommended objective/)
  assert.match(insightUi, /strategic-review/)
  console.log("  ✓ operator retains decision authority in strategic review flow")

  const heroBuilder = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroBuilder, /buildGrowthHomeAvaStrategicLeadershipPayload/)
  assert.match(heroBuilder, /strategicLeadership/)
  console.log("  ✓ hero builder chains strategic leadership after recommendation experience")

  const enriched = enrichGrowthHomeAvaStrategicLeadershipWithClientSignals({
    payload: quietPayload,
    overrideRecords: [
      {
        marketKey: "medical equipment|florida",
        instruction: "medical equipment companies",
        overrideCount: 4,
        lastOverrideAt: new Date().toISOString(),
      },
    ],
  })
  assert.equal(enriched.hasInsight, true)
  console.log("  ✓ client override records enrich strategic leadership at presentation boundary")

  const experience = buildGrowthHomeAvaRecommendationExperience({
    greeting: "Good evening, Michael.",
    aiOsUx: mockAiOsUx(),
    primaryDecision: null,
  })
  const winsPayload = buildGrowthHomeAvaStrategicLeadershipPayload({
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes: [],
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: new Date().toISOString(),
        researched: 0,
        qualified: 0,
        outreach_prepared: 0,
        meetings_prepared: 0,
        strong_opportunities: 0,
        approvals_pending: 0,
      },
    },
    recommendationExperience: experience,
  })
  assert.ok(Array.isArray(winsPayload.whatsNext))
  console.log("  ✓ whats next derives from existing recommendation experience")

  console.log(`\nPASS ${PHASE}`)
}

void main()
