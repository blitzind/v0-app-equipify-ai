/**
 * GE-AIOS-LIVE-3B — Home operator experience certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-3b-operator-experience
 */
import assert from "node:assert/strict"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import type { GrowthHomeAvaRecommendationItem } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  buildHeroCurrentWorkNarrative,
  buildHomeCompletedTodayTimeline,
  buildHomeMeasurableProgressPresentation,
  buildHomeWorkingNowPresentation,
  buildHomeWorkspaceHealthPresentation,
  detectHomeSectionNarrativeOverlap,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
} from "../lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

const PHASE = "GE-AIOS-LIVE-3B" as const

function productionMission(): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6",
    lifecycleState: "finding_leads",
    activityLabel: "Finding leads",
    counters: {
      draftsPrepared: 1,
      recordsImported: 25,
      pendingApprovals: 0,
      researchingCount: 0,
      newCompaniesFound: 25,
    },
    searchSummary: "Equipify supported service verticals audience",
    audienceName: "Equipify supported service verticals audience",
    recordsImported: 25,
    newCompaniesFound: 25,
    leadPoolVisible: 53,
    leadPoolHasMore: true,
    pipelineLow: false,
    lastEventSummary: "Monitoring Datamoon audience.",
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
  }
}

function approvalRecommendation(): GrowthHomeAvaRecommendationItem {
  return {
    id: "rec-1",
    kind: "approval_package",
    headline: "Prepare another review-ready opportunity package.",
    companyName: "Acme Services",
    detail: "Package is ready for review.",
    supportingLine: null,
    outcomeLine: null,
    whyReasons: [],
    href: "/growth/review",
    estimatedEffortLabel: "2 minutes",
  }
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function main(): void {
  console.log(`[${PHASE}] Home operator experience certification`)
  const mission = productionMission()

  runGate("Hero answers what Ava is doing without idle copy", () => {
    const hero = buildHeroCurrentWorkNarrative({
      statusLabel: "Finding Leads",
      missionDiscovery: mission,
      discoveryTarget: mission.audienceName,
      dailyActivityNarrative: {
        qaMarker: "test",
        focus: "discovery",
        lines: [],
        completed_today: [],
        working_now: ["I'm searching for companies matching Equipify supported service verticals audience."],
        waiting_on_you: [],
        learned_today: [],
        working_next: ["Next I'll run our Find Leads search."],
        section_order: ["working_now", "working_next"],
      },
    })
    assert.match(hero, /Growth Profile/i)
    assert.doesNotMatch(hero, /getting oriented/i)
  })

  runGate("Working Now answers what task is running", () => {
    const workingNow = buildHomeWorkingNowPresentation({
      missionDiscovery: mission,
      statusLabel: "Finding Leads",
      dailyActivityNarrative: {
        qaMarker: "test",
        focus: "discovery",
        lines: [],
        completed_today: [],
        working_now: ["I'm searching for companies matching Equipify supported service verticals audience."],
        waiting_on_you: [],
        learned_today: [],
        working_next: ["Next I'll run our Find Leads search."],
        section_order: ["working_now", "working_next"],
      },
    })
    assert.ok(workingNow.activeTask)
    assert.ok(workingNow.nextStep)
    assert.equal(workingNow.currentPhase, "Finding leads")
  })

  runGate("Progress shows measurable counters only", () => {
    const progress = buildHomeMeasurableProgressPresentation({
      missionDiscovery: mission,
      portfolio: {
        qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
        targetActiveCompanies: 100,
        currentActiveCompanies: 18,
        minimumHealthyCompanies: 80,
        needsCount: 82,
        healthState: "needs_replenishment",
        healthLabel: "Portfolio needs replenishment",
        discoveryRunning: true,
        discoveryRunningCount: 1,
        discoveryStatusDisplay: "Running",
        nextBatchSize: 25,
        showEstimatedHealthy: false,
        researchRunning: false,
        researchRunningCount: 0,
        admissionsPending: 0,
        projectedCompletionLabel: null,
        manualFindOptions: [25, 50],
      },
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: new Date().toISOString(),
        researched: 6,
        qualified: 4,
        strong_opportunities: 2,
        outreach_prepared: 1,
        meetings_prepared: 0,
        approvals_pending: 0,
      },
    })
    assert.ok(progress.items.some((item) => item.label === "Companies discovered"))
    assert.ok(progress.items.some((item) => item.label === "Active companies"))
    assert.ok(progress.items.every((item) => !/I'm searching/i.test(item.label)))
  })

  runGate("Recommendation copy sounds like Ava speaking", () => {
    const enriched = enrichGrowthHomeAvaRecommendationItemNext1b({
      item: approvalRecommendation(),
    })
    assert.match(enriched.employeeHeadline ?? "", /strong fit at Acme Services/i)
    assert.match(enriched.employeeLeadParagraph ?? "", /recommend reviewing/i)
    assert.doesNotMatch(enriched.employeeHeadline ?? "", /Prepare another review-ready/i)
  })

  runGate("Portfolio and workspace health use existing metrics", () => {
    const health = buildHomeWorkspaceHealthPresentation({
      relationshipSnapshotCount: 53,
      totalOpportunities: 115,
      pendingApprovals: 1,
      portfolio: {
        qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1",
        targetActiveCompanies: 100,
        currentActiveCompanies: 18,
        minimumHealthyCompanies: 80,
        needsCount: 82,
        healthState: "needs_replenishment",
        healthLabel: "Portfolio needs replenishment",
        discoveryRunning: true,
        discoveryRunningCount: 1,
        discoveryStatusDisplay: "Running",
        nextBatchSize: 25,
        showEstimatedHealthy: false,
        researchRunning: false,
        researchRunningCount: 0,
        admissionsPending: 0,
        projectedCompletionLabel: null,
        manualFindOptions: [25, 50],
      },
    })
    assert.equal(health.qaMarker, GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER)
    assert.ok(health.items.some((item) => item.label === "Active relationships"))
    assert.ok(health.items.some((item) => item.label === "Packages awaiting review"))
  })

  runGate("Completed today timeline is chronological presentation", () => {
    const timeline = buildHomeCompletedTodayTimeline({
      dailyActivityNarrative: {
        qaMarker: "test",
        focus: "discovery",
        lines: [],
        completed_today: ["Imported 25 companies", "Qualified 6 companies"],
        working_now: [],
        waiting_on_you: [],
        learned_today: [],
        working_next: [],
        section_order: ["completed_today"],
      },
      salesOutcomes: [
        {
          work_item_id: "w1",
          company_id: null,
          person_id: null,
          relationship_stage: null,
          outcome_type: "research_completed",
          confidence: 0.9,
          completed_by: "research_agent",
          validated_by: "sales_specialist",
          completed_at: "2026-07-20T14:12:00.000Z",
          summary: "Completed research",
          generated_artifacts: [],
          approval_required: false,
          recommended_next_action: null,
          memory_events: [],
        },
      ],
    })
    assert.ok(timeline.length >= 2)
    assert.ok(timeline.some((entry) => entry.timeLabel.includes(":")))
  })

  runGate("Hero and Working Now do not duplicate identical narratives", () => {
    const hero = buildHeroCurrentWorkNarrative({
      statusLabel: "Finding Leads",
      missionDiscovery: mission,
      discoveryTarget: mission.audienceName,
      dailyActivityNarrative: {
        qaMarker: "test",
        focus: "discovery",
        lines: [],
        completed_today: [],
        working_now: ["I'm searching for companies matching Equipify supported service verticals audience."],
        waiting_on_you: [],
        learned_today: [],
        working_next: ["Next I'll run our Find Leads search."],
        section_order: ["working_now", "working_next"],
      },
    })
    const workingNow = buildHomeWorkingNowPresentation({
      missionDiscovery: mission,
      dailyActivityNarrative: {
        qaMarker: "test",
        focus: "discovery",
        lines: [],
        completed_today: [],
        working_now: ["I'm searching for companies matching Equipify supported service verticals audience."],
        waiting_on_you: [],
        learned_today: [],
        working_next: ["Next I'll run our Find Leads search."],
        section_order: ["working_now", "working_next"],
      },
    })
    const overlap = detectHomeSectionNarrativeOverlap({
      heroNarrative: hero,
      workingNowTask: workingNow.activeTask,
      objectiveTitle: "Build production pipeline",
      recommendationHeadline: "I found another promising company — Acme Services.",
      progressLabels: ["Companies discovered", "Active companies"],
    })
    assert.equal(overlap.includes("hero_working_now"), false)
  })

  console.log(`[${PHASE}] PASS`)
}

main()
