/**
 * GE-GROWTH-HOME-EXECUTIVE-BRIEFING-2A — Executive briefing presentation certification.
 * Run: pnpm test:ge-growth-home-executive-briefing-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER,
  GROWTH_HOME_EXECUTIVE_SNAPSHOT_TITLE,
  GROWTH_HOME_NOTHING_REQUIRES_APPROVAL,
  GROWTH_HOME_REVIEW_TODAYS_WORK_LABEL,
  GROWTH_HOME_VIEW_MISSION_CENTER_LABEL,
  buildExecutiveSnapshotKpis,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"

const PHASE = "GE-GROWTH-HOME-EXECUTIVE-BRIEFING-2A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function indexOfMount(source: string, needle: string): number {
  return source.indexOf(`<${needle}`)
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Executive briefing presentation certification`)

  assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER, "ge-growth-home-executive-briefing-2a-v1")
  assert.equal(GROWTH_HOME_EXECUTIVE_SNAPSHOT_TITLE, "Executive Snapshot")
  assert.equal(GROWTH_HOME_REVIEW_TODAYS_WORK_LABEL, "Review Today's Work")
  assert.equal(GROWTH_HOME_VIEW_MISSION_CENTER_LABEL, "View Mission Center")
  assert.equal(GROWTH_HOME_NOTHING_REQUIRES_APPROVAL, "Nothing requires your approval right now.")

  const snapshot = buildExecutiveSnapshotKpis({
    hero: {
      greeting: "Good morning, Mike.",
      introLine: "Here's what I've been working on.",
      todayAtAGlance: [],
      revenueToday: [],
      executiveKpis: [{ id: "revenue-influenced", title: "Pipeline", value: "$120,000", status: "Impact" }],
      biggestOpportunity: null,
      biggestRisk: null,
      opportunityAction: null,
      riskAction: null,
      expectedOutcomeToday: null,
      overallConfidencePercent: 80,
      overallConfidenceLabel: "High",
    },
    aiOsUx: {
      qaMarker: "growth-home-ai-os-ux-v1",
      hero: {} as never,
      waitingOnYou: [],
      waitingOnYouOverflow: 0,
      approveItemsHref: null,
      approveItemsCount: 0,
      liveStatus: null,
      dailyWorkQueueBuckets: null,
      dailyWorkQueue: [],
      throughput: [],
      mailboxDomainHealth: null,
      autonomousReadiness: null,
    },
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [
        {
          id: "intelligence",
          metrics: [{ label: "Hot companies", value: 18, href: "/growth" }],
        },
        {
          id: "my-queue",
          metrics: [{ label: "Call-ready leads", value: 4, href: "/growth" }],
        },
        {
          id: "campaign-snapshot",
          metrics: [{ label: "Approval queue", value: 2, href: "/growth" }],
        },
      ],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
  })

  assert.equal(snapshot.length, 5)
  assert.equal(snapshot[0]?.label, "Companies Found")
  assert.equal(snapshot[0]?.value, "18")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER/)
  assert.match(dashboard, /GrowthHomeExecutiveSnapshotSection/)
  assert.match(dashboard, /GrowthHomeGrowthStrategySection/)

  const hero = indexOfMount(dashboard, "GrowthHomeExecutiveBriefingHeroSection")
  const snapshotMount = indexOfMount(dashboard, "GrowthHomeExecutiveSnapshotSection")
  const needs = indexOfMount(dashboard, "GrowthHomeAiOsWaitingOnYouSection")
  assert.ok(snapshotMount > hero)
  assert.ok(needs > snapshotMount)

  const heroSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-hero-section.tsx",
  )
  assert.match(heroSource, /greetingForHour\(new Date\(\)\.getHours\(\)\)/)
  assert.doesNotMatch(heroSource, /bg-indigo-600/)

  const waiting = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(waiting, /CheckCircle2/)
  assert.match(waiting, /GROWTH_HOME_NOTHING_REQUIRES_APPROVAL/)

  const mission = readSource(
    "components/growth/workspace/executive-briefing/growth-home-mission-center-section.tsx",
  )
  assert.match(mission, /View Mission/)
  assert.match(mission, /presentationStageLabel/)

  const timeline = readSource("components/growth/workspace/executive-briefing/growth-home-timeline-section.tsx")
  assert.match(timeline, /overflow-x-auto/)

  const operational = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(operational, /lg:grid-cols-2/)
  assert.match(operational, /embedded/)

  console.log(`[${PHASE}] PASS — Executive briefing presentation certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
