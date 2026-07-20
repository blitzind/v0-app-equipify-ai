/**
 * GE-AIOS-LIVE-3C — Human-centered Home language certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-3c-human-centered-home-language
 */
import assert from "node:assert/strict"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import type { GrowthHomeAvaRecommendationItem } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  buildHeroExecutiveBriefing,
  detectHomeSectionNarrativeOverlap,
  GROWTH_HOME_SECTION_COMPLETED_TODAY_TITLE,
  GROWTH_HOME_SECTION_OBJECTIVE_TITLE,
  GROWTH_HOME_SECTION_PORTFOLIO_TITLE,
  GROWTH_HOME_SECTION_PROGRESS_TITLE,
  GROWTH_HOME_SECTION_RECOMMENDATION_TITLE,
  GROWTH_HOME_SECTION_WORKING_NOW_TITLE,
  GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER,
  humanizeOperatorFacingCopy,
} from "../lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

const PHASE = "GE-AIOS-LIVE-3C" as const

const INTERNAL_TERMS = [
  "missionDiscovery",
  "lifecycle state",
  "operator projection",
  "startup discovery",
  "readyForOutreachReview",
  "finding_leads",
  "Run Prospect Search",
]

function mission(): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6",
    lifecycleState: "finding_leads",
    activityLabel: "Finding leads",
    counters: {
      draftsPrepared: 0,
      recordsImported: 0,
      pendingApprovals: 0,
      researchingCount: 0,
      newCompaniesFound: 0,
    },
    searchSummary: "Equipify supported service verticals audience",
    audienceName: "Equipify supported service verticals audience",
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 53,
    leadPoolHasMore: true,
    pipelineLow: false,
    lastEventSummary: "Monitoring Datamoon audience.",
    discoveryAction: "run_prospect_search",
    startupDiscoveryReady: true,
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
  console.log(`[${PHASE}] Human-centered Home language certification`)

  runGate("Section labels use business language", () => {
    assert.equal(GROWTH_HOME_SECTION_PROGRESS_TITLE, "What I've Accomplished")
    assert.equal(GROWTH_HOME_SECTION_WORKSPACE_HEALTH_TITLE, "Business Snapshot")
    assert.equal(GROWTH_HOME_SECTION_PORTFOLIO_TITLE, "Sales Pipeline")
    assert.equal(GROWTH_HOME_SECTION_COMPLETED_TODAY_TITLE, "What I've Completed Today")
    assert.equal(GROWTH_HOME_SECTION_WORKING_NOW_TITLE, "What I'm Working On")
    assert.equal(GROWTH_HOME_SECTION_OBJECTIVE_TITLE, "Why I'm Doing This")
    assert.equal(GROWTH_HOME_SECTION_RECOMMENDATION_TITLE, "What I Recommend")
    assert.equal(GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER, "ge-aios-live-3c-human-centered-home-language-v1")
  })

  runGate("Hero executive briefing includes current work and next step", () => {
    const withoutAction = buildHeroExecutiveBriefing({
      statusLabel: "Finding Leads",
      missionDiscovery: mission(),
      pendingApprovals: 0,
      readyForOutreachReview: 0,
    })
    assert.match(withoutAction.narrative, /Growth Profile/i)
    assert.match(withoutAction.narrative, /researching the strongest matches/i)
    assert.ok(withoutAction.paragraphs.length <= 2)

    const withAction = buildHeroExecutiveBriefing({
      statusLabel: "Preparing outreach",
      missionDiscovery: mission(),
      pendingApprovals: 0,
      readyForOutreachReview: 1,
    })
    assert.match(withAction.narrative, /outreach package ready for your review/i)
    assert.match(withAction.narrative, /continue building the rest of your pipeline/i)
  })

  runGate("Hero avoids internal architecture terminology", () => {
    const briefing = buildHeroExecutiveBriefing({
      statusLabel: "Finding Leads",
      missionDiscovery: mission(),
      readyForOutreachReview: 1,
    })
    for (const term of INTERNAL_TERMS) {
      assert.doesNotMatch(briefing.narrative, new RegExp(term, "i"))
    }
  })

  runGate("Recommendation uses Ava-voice presentation", () => {
    const item: GrowthHomeAvaRecommendationItem = {
      id: "rec-1",
      kind: "approval_package",
      headline: "Prepare another review-ready opportunity package.",
      companyName: "Diverse Power Foundation",
      detail: null,
      supportingLine: null,
      outcomeLine: null,
      whyReasons: [],
      href: "/growth/review",
      estimatedEffortLabel: "2 minutes",
    }
    const enriched = enrichGrowthHomeAvaRecommendationItemNext1b({ item })
    assert.match(enriched.employeeHeadline ?? "", /strong fit at Diverse Power Foundation/i)
    assert.match(enriched.employeeLeadParagraph ?? "", /reviewing the outreach package/i)
    assert.doesNotMatch(enriched.employeeHeadline ?? "", /Prepare another review-ready/i)
    assert.doesNotMatch(enriched.employeeLeadParagraph ?? "", /sent outreach/i)
  })

  runGate("Humanization removes technical operator phrasing", () => {
    const copy = humanizeOperatorFacingCopy(
      "Run Prospect Search — Equipify supported service verticals audience",
    )
    assert.match(copy, /Growth Profile/i)
    assert.doesNotMatch(copy, /Run Prospect Search/i)
  })

  runGate("Hero summary does not duplicate recommendation headline", () => {
    const hero = buildHeroExecutiveBriefing({
      statusLabel: "Preparing outreach",
      missionDiscovery: mission(),
      readyForOutreachReview: 1,
    })
    const recommendation = "I found a strong fit at Diverse Power Foundation."
    const overlap = detectHomeSectionNarrativeOverlap({
      heroNarrative: hero.narrative,
      workingNowTask: "Searching for companies that match your Growth Profile",
      objectiveTitle: "Build a healthy production pipeline",
      recommendationHeadline: recommendation,
      progressLabels: ["Researched today"],
    })
    assert.equal(overlap.includes("hero_working_now"), false)
  })

  console.log(`[${PHASE}] PASS`)
}

main()
