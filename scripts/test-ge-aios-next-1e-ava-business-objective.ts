/**
 * GE-AIOS-NEXT-1E — Ava owns the business objective (Home leadership centerpiece).
 * Run: pnpm test:ge-aios-next-1e-ava-business-objective
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeAvaBusinessObjectiveLeadershipPayload,
  buildGrowthHomeAvaRecommendationObjectiveContext,
  enrichGrowthHomeAvaRecommendationExperienceNext1e,
  enrichGrowthHomeAvaRecommendationItemNext1e,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e"
import {
  GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER,
  GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import { enrichGrowthHomeAvaRecommendationItemNext1d } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import { buildGrowthHomeAvaRecommendationExperience } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-queue-next-1a"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"
import { GROWTH_OBJECTIVE_QA_MARKER, GROWTH_OBJECTIVE_RUNTIME_QA_MARKER } from "../lib/growth/objectives/growth-objective-types"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "../lib/growth/mission-center/growth-mission-runtime-types"
import { buildGrowthLeadHref } from "../lib/growth/navigation/growth-workspace-operator-links"

const PHASE = "GE-AIOS-NEXT-1E-AVA-BUSINESS-OBJECTIVE" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockObjective(overrides: Partial<GrowthObjective> = {}): GrowthObjective {
  return {
    id: "objective-packages",
    organizationId: "org-1",
    title: "Generate 15 qualified opportunity packages this week",
    description: "Prepare review-ready packages for outreach.",
    objectiveType: "opportunities_created",
    targetValue: 15,
    currentValue: 11,
    startDate: null,
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "high",
    autonomyLevel: "assisted",
    safetyMode: "balanced",
    plan: {
      objectiveId: "objective-packages",
      generatedAt: new Date().toISOString(),
      qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
      icpStrategy: {
        industries: [],
        companySize: null,
        geography: null,
        keywords: [],
        persona: null,
        summary: "Equipment service operators",
      },
      savedSearches: [],
      audiences: [],
      researchRequirements: [],
      buyingCommitteeRequirements: [],
      assetsRequired: [],
      channelsRequired: [],
      automationPlaybooks: [],
      successMetrics: ["Qualified packages prepared for operator review"],
      stages: [],
      forecast: {
        leadsNeeded: 0,
        audienceSizeRequired: 0,
        assetsRequired: 0,
        estimatedSends: 0,
        estimatedOutcomes: 15,
        estimatedDays: 7,
        assumptions: [],
      },
    },
    runtime: {
      qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
      currentStageId: "research",
      stageStates: {} as GrowthObjective["runtime"] extends infer R ? R extends { stageStates: infer S } ? S : never : never,
      startedAt: null,
      lastTickAt: null,
      stoppedAt: null,
      estimatedCompletionDate: null,
      running: true,
    },
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: {
      qa_marker: "growth-objective-ge-auto-2g-v1",
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: {
        qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
        approved: true,
        approvedAt: new Date().toISOString(),
        lifecycleState: "researching",
        activityLabel: "Researching qualified companies",
        lastOrchestrationAt: null,
        counters: {
          newCompaniesFound: 2,
          recordsImported: 4,
          researchingCount: 9,
          draftsPrepared: 11,
          pendingApprovals: 1,
        },
        audience: null,
        datamoon: null,
        events: [],
      },
    },
    emergencyStopActive: false,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
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

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.match(GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE, /owns business objectives/i)
  console.log("  ✓ ownership principle documented")

  const leadership = buildGrowthHomeAvaBusinessObjectiveLeadershipPayload({
    objectives: [
      mockObjective(),
      mockObjective({
        id: "objective-meetings",
        title: "Book 6 qualified meetings",
        objectiveType: "meetings_booked",
        targetValue: 6,
        currentValue: 3,
        priority: "medium",
      }),
    ],
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "objective-packages",
      lifecycleState: "researching",
      activityLabel: "Researching qualified companies",
      counters: {
        newCompaniesFound: 2,
        recordsImported: 4,
        researchingCount: 9,
        draftsPrepared: 11,
        pendingApprovals: 1,
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
    },
    pendingApprovalCount: 1,
    meetingsThisWeek: 3,
    openOpportunities: 11,
    leadPoolVisible: 142,
  })

  assert.equal(leadership.qaMarker, GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER)
  assert.equal(leadership.teamObjectiveLine, "Our current objective")
  assert.match(leadership.recommendationIntro, /help us achieve it/i)
  assert.ok(leadership.primaryObjective)
  assert.match(leadership.primaryObjective!.progressLabel, /11 of 15 packages prepared/i)
  assert.equal(leadership.primaryObjective!.ownerLabel, "Ava")
  assert.ok(leadership.scoreboard.some((row) => row.id === "qualified_packages"))
  assert.ok(leadership.scoreboard.some((row) => row.id === "portfolio"))
  assert.ok(leadership.secondaryObjective)
  console.log("  ✓ objective leadership projects primary, secondary, and scoreboard from existing objectives")

  const enrichedItem = enrichGrowthHomeAvaRecommendationItemNext1e({
    item: enrichGrowthHomeAvaRecommendationItemNext1d({
      item: enrichGrowthHomeAvaRecommendationItemNext1b({
        item: {
          id: "decision:1",
          rank: 2,
          kind: "lead_decision",
          title: "Finish research for Blitz Industries",
          headline: "Finish research for Blitz Industries",
          detail: "Highest expected ROI",
          supportingLine: "Research is already 82% complete.",
          outcomeLine: "Prepare outreach package",
          estimatedMinutes: 3,
          estimatedEffortLabel: "3 minutes",
          href: buildGrowthLeadHref("lead-blitz"),
          leadId: "lead-blitz",
          companyName: "Blitz Industries",
          whyReasons: ["Blitz Industries is already 82% researched."],
          sourceLabel: "test",
        },
      }),
    }),
    businessObjectiveLeadership: leadership,
  })

  assert.match(enrichedItem.outcomeProjection?.objectiveContext?.contributionLabel ?? "", /package #12/i)
  assert.match(enrichedItem.outcomeProjection?.objectiveContext?.remainingLabel ?? "", /3 packages remaining/i)
  assert.match(enrichedItem.explanation?.whyChosen[0] ?? "", /current objective/i)
  console.log("  ✓ recommendations explicitly connect to the current business objective")

  const completedLeadership = buildGrowthHomeAvaBusinessObjectiveLeadershipPayload({
    objectives: [
      mockObjective({ currentValue: 15, status: "completed" }),
      mockObjective({
        id: "objective-meetings",
        title: "Increase qualified meetings",
        objectiveType: "meetings_booked",
        targetValue: 6,
        currentValue: 3,
        priority: "high",
      }),
    ],
  })
  assert.equal(completedLeadership.primaryObjective?.title, "Increase qualified meetings")
  assert.match(completedLeadership.recommendationIntro, /help us achieve it/i)

  const allCompleteLeadership = buildGrowthHomeAvaBusinessObjectiveLeadershipPayload({
    objectives: [mockObjective({ currentValue: 15, status: "completed" })],
  })
  assert.equal(allCompleteLeadership.primaryObjective?.completed, true)
  assert.match(allCompleteLeadership.recommendationIntro, /next objective/i)
  console.log("  ✓ completed objectives transition to next objective recommendation")

  const experience = buildGrowthHomeAvaRecommendationExperience({
    greeting: "Good evening, Michael.",
    aiOsUx: mockAiOsUx(),
    primaryDecision: null,
    businessObjectiveLeadership: leadership,
  })
  assert.match(experience.recommendationIntro, /help us achieve it/i)
  console.log("  ✓ recommendation queue chains objective leadership at presentation boundary")

  const objectiveSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e.ts")
  assert.match(objectiveSource, /selectAcquisitionMission/)
  assert.match(objectiveSource, /objectiveProgressPercent/)
  assert.doesNotMatch(objectiveSource, /buildGrowthMissionPriorityReadModel|scoreMissionPriority/)
  assert.doesNotMatch(objectiveSource, /applyGrowthHomeAvaRecommendationPreferenceBoost/)
  console.log("  ✓ objective projection reuses existing authority without duplicate engines")

  const ui = readSource("components/growth/workspace/executive-briefing/growth-home-ava-business-objective-section.tsx")
  assert.match(ui, /Our current objective|teamObjectiveLine/)
  assert.match(ui, /Why this objective/)
  const heroUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroUi, /GrowthHomeAvaScoreboardSection/)
  console.log("  ✓ Home UI elevates business objective above recommendations with separate scoreboard")

  const hero = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(hero, /GrowthHomeAvaBusinessObjectiveSection/)
  console.log("  ✓ hero wires objective leadership centerpiece")

  const summary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summary, /businessObjectiveLeadership/)
  console.log("  ✓ workspace summary exposes objective leadership read model")

  const enrichedExperience = enrichGrowthHomeAvaRecommendationExperienceNext1e({
    experience: {
      qaMarker: "ge-aios-next-1a-ava-recommendation-home-v1",
      openingLine: "Hello",
      sinceLastVisitLine: "Since last visit",
      recommendationIntro: "Here's what I recommend.",
      recommendations: [],
      hasRecommendations: false,
      exhaustedMessage: "Done",
    },
    businessObjectiveLeadership: leadership,
  })
  assert.match(enrichedExperience.recommendationIntro, /help us achieve it/i)
  console.log("  ✓ experience enricher updates recommendation intro from objective ownership")

  console.log(`\nPASS ${PHASE}`)
}

void main()
