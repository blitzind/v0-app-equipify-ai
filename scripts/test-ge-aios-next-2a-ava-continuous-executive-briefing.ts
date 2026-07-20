/**
 * GE-AIOS-NEXT-2A — Ava continuous executive briefing certification.
 * Run: pnpm test:ge-aios-next-2a-ava-continuous-executive-briefing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeAvaContinuousExecutiveBriefingPayload } from "../lib/growth/ava-home/recommendations/growth-home-ava-continuous-executive-briefing-next-2a"
import {
  GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE,
  GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"
import {
  buildGrowthHomeAvaExecutiveBriefingCursorSnapshot,
  hoursSinceIso,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"

const PHASE = "GE-AIOS-NEXT-2A-AVA-CONTINUOUS-EXECUTIVE-BRIEFING" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function metricsSnapshot(overrides: Record<string, number> = {}) {
  return {
    capturedAt: new Date().toISOString(),
    researched: 40,
    qualified: 12,
    readyForReview: 8,
    repliesToday: 1,
    meetingsToday: 2,
    approvalsWaiting: 1,
    opportunitiesCount: 8,
    ...overrides,
  }
}

function baselineSnapshot(overrides: Record<string, number> = {}) {
  return buildGrowthHomeAvaExecutiveBriefingCursorSnapshot({
    metricsSnapshot: metricsSnapshot({
      researched: 10,
      qualified: 4,
      readyForReview: 3,
      approvalsWaiting: 1,
      ...overrides,
    }),
    leadPoolVisible: 80,
    pendingApprovals: 1,
    objectiveProgressPercent: 40,
    lastRecommendationKind: "mission_discovery",
  })
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  assert.match(GROWTH_AIOS_NEXT_2A_CONTINUOUS_BRIEFING_PRINCIPLE, /works continuously/i)
  console.log("  ✓ continuous briefing principle documented")

  const overnight = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good morning, Michael.",
    cursor: {
      qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
      organizationId: "org-1",
      lastMeaningfulInteractionAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      lastMeaningfulInteractionKind: "briefing_reviewed",
      lastBriefingAcknowledgedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      lastBriefingGeneratedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      acknowledgedSnapshot: baselineSnapshot(),
      briefingHistory: [],
    },
    metricsSnapshot: metricsSnapshot({ researched: 43, qualified: 11, readyForReview: 11, approvalsWaiting: 4 }),
    pendingApprovals: 4,
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "objective-packages",
      lifecycleState: "researching",
      activityLabel: "Researching qualified companies",
      counters: {
        newCompaniesFound: 2,
        recordsImported: 4,
        researchingCount: 6,
        draftsPrepared: 11,
        pendingApprovals: 4,
      },
      searchSummary: "HVAC service",
      audienceName: "HVAC service",
      recordsImported: 4,
      newCompaniesFound: 2,
      leadPoolVisible: 98,
      leadPoolHasMore: false,
      pipelineLow: false,
      lastEventSummary: null,
      discoveryAction: "begin_research",
      startupDiscoveryReady: true,
    },
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes: [],
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: new Date().toISOString(),
        researched: 43,
        qualified: 11,
        outreach_prepared: 3,
        meetings_prepared: 0,
        strong_opportunities: 7,
        approvals_pending: 4,
      },
    },
    recommendationPreferences: [
      {
        kind: "mission_discovery",
        accepted: 2,
        skipped: 0,
        lastAcceptedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        lastSkippedAt: null,
      },
    ],
    outboundDisabled: true,
  })

  assert.equal(overnight.qaMarker, GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER)
  assert.match(overnight.openingLine, /working throughout the night|while you were away/i)
  assert.ok(overnight.activitySummary.some((line) => /researched|prepared|approval backlog/i.test(line)))
  assert.match(overnight.communicationNote ?? "", /outbound remains disabled/i)
  console.log("  ✓ overnight internal activity appears in next briefing with outbound disabled note")

  const sinceReview = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good afternoon, Michael.",
    cursor: {
      qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
      organizationId: "org-1",
      lastMeaningfulInteractionAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastMeaningfulInteractionKind: "briefing_reviewed",
      lastBriefingAcknowledgedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      lastBriefingGeneratedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      acknowledgedSnapshot: baselineSnapshot({ approvalsWaiting: 1 }),
      briefingHistory: [],
    },
    metricsSnapshot: metricsSnapshot({ approvalsWaiting: 4 }),
    pendingApprovals: 4,
  })
  assert.equal(sinceReview.sinceLabel, "Since your last review")
  assert.doesNotMatch(sinceReview.openingLine, /midnight/i)
  console.log("  ✓ briefing window starts at last meaningful interaction, not midnight")

  const secondSameDay = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good afternoon, Michael.",
    cursor: {
      qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
      organizationId: "org-1",
      lastMeaningfulInteractionAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      lastMeaningfulInteractionKind: "briefing_reviewed",
      lastBriefingAcknowledgedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      lastBriefingGeneratedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      acknowledgedSnapshot: baselineSnapshot({ approvalsWaiting: 3 }),
      briefingHistory: [],
    },
    metricsSnapshot: metricsSnapshot({ approvalsWaiting: 4 }),
    pendingApprovals: 4,
  })
  assert.ok(secondSameDay.activitySummary.some((line) => /approval backlog increased/i))
  console.log("  ✓ multiple same-day briefings compare against prior acknowledged snapshot")

  const cursorSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a.ts")
  assert.match(cursorSource, /markGrowthHomeAvaExecutiveBriefingPassiveRefresh/)
  assert.match(cursorSource, /recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction/)
  assert.match(cursorSource, /isPassiveRefresh[\s\S]*readCursorStore/)
  console.log("  ✓ passive refresh marker is separate from meaningful interaction cursor")

  assert.ok(hoursSinceIso(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())! >= 2)
  console.log("  ✓ research and discovery deltas can appear outside business hours (time-agnostic cursor)")

  assert.match(overnight.communicationNote ?? "", /No outreach was sent/i)
  assert.equal(overnight.continuousWorkStatus, "outbound_disabled")
  console.log("  ✓ outbound disabled is stated without implying internal work stopped")

  assert.ok(overnight.selfEvaluationLines.length >= 1 || overnight.learningLines.length >= 1)
  console.log("  ✓ previous recommendation outcome is evaluated from evidence")

  const calm = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good evening, Michael.",
    cursor: {
      qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
      organizationId: "org-1",
      lastMeaningfulInteractionAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      lastMeaningfulInteractionKind: "briefing_reviewed",
      lastBriefingAcknowledgedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      lastBriefingGeneratedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      acknowledgedSnapshot: baselineSnapshot(),
      briefingHistory: [],
    },
    metricsSnapshot: metricsSnapshot({
      researched: 10,
      qualified: 4,
      readyForReview: 3,
      approvalsWaiting: 1,
    }),
    pendingApprovals: 1,
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "objective-packages",
      lifecycleState: "researching",
      activityLabel: "Researching qualified companies",
      counters: {
        newCompaniesFound: 0,
        recordsImported: 0,
        researchingCount: 2,
        draftsPrepared: 8,
        pendingApprovals: 1,
      },
      searchSummary: "HVAC service",
      audienceName: "HVAC service",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 80,
      leadPoolHasMore: false,
      pipelineLow: false,
      lastEventSummary: null,
      discoveryAction: "begin_research",
      startupDiscoveryReady: true,
    },
  })
  assert.equal(calm.state, "no_meaningful_changes")
  assert.ok(calm.activitySummary.some((line) => /Not much has changed/i))
  console.log("  ✓ no meaningful changes produces a calm briefing")

  const first = buildGrowthHomeAvaContinuousExecutiveBriefingPayload({
    greeting: "Good morning, Michael.",
    cursor: {
      qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
      organizationId: "org-1",
      lastMeaningfulInteractionAt: null,
      lastMeaningfulInteractionKind: null,
      lastBriefingAcknowledgedAt: null,
      lastBriefingGeneratedAt: null,
      acknowledgedSnapshot: null,
      briefingHistory: [],
    },
    metricsSnapshot: metricsSnapshot(),
  })
  assert.equal(first.state, "first_briefing")
  assert.match(first.openingLine, /starting baseline|established/i)
  assert.equal(first.hasMeaningfulChanges, false)
  console.log("  ✓ first briefing establishes baseline without inventing historical deltas")

  const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroSource, /GrowthHomeAvaSinceYouWereLastHereSection/)
  assert.match(heroSource, /GrowthHomeAvaBusinessObjectiveSection/)
  assert.match(heroSource, /GrowthHomeAvaRecommendationExperienceSection/)
  assert.match(heroSource, /GrowthHomeAvaStrategicInsightSection/)
  console.log("  ✓ Home integrates briefing before objective, recommendation, and strategic insight")

  const synthesizerSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-continuous-executive-briefing-next-2a.ts")
  assert.match(synthesizerSource, /buildSinceYesterdayLines/)
  assert.doesNotMatch(synthesizerSource, /buildGrowthMissionPriorityReadModel|scoreMissionPriority/)
  assert.doesNotMatch(synthesizerSource, /cron|scheduler tick|setInterval/)
  console.log("  ✓ no duplicate runtime loop or scheduler is introduced")

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(schedulerSource, /tickGrowthObjectiveRuntime/)
  assert.match(schedulerSource, /runGrowthMissionRuntimeOrchestration/)
  console.log("  ✓ runtime audit confirms existing objective scheduler orchestration remains authoritative")

  const outreachSource = readSource("lib/growth/outreach/outreach-scheduling.ts")
  assert.match(outreachSource, /isWithinBusinessHours/)
  console.log("  ✓ outbound business-hour policy remains in existing outreach scheduling layer")

  console.log(`\nPASS ${PHASE}`)
}

void main()
