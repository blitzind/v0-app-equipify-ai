/**
 * GE-AIOS-13A — Ava Operating Rhythm certification.
 * Run: pnpm test:ge-aios-13a-operating-rhythm
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import {
  AVA_OPERATING_PHASE_ORDER,
  GROWTH_OPERATING_RHYTHM_QA_MARKER,
  buildOperatingRhythm,
  buildOperatingRhythmMemory,
  buildOperatingRhythmStoryBlocks,
  continueCurrentPhase,
  pauseCurrentPhase,
  resumeCurrentPhase,
  runEndOfDayReflection,
  runOperatingRhythm,
  startMorningPlanning,
} from "../lib/growth/operating-rhythm"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-13A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseAiOsUx(overrides: Partial<GrowthHomeAiOsUxViewModel> = {}): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
    hero: {} as never,
    waitingOnYou: [],
    waitingOnYouOverflow: 0,
    approveItemsHref: "/growth/approvals",
    approveItemsCount: 0,
    liveStatus: null,
    dailyWorkQueueBuckets: null,
    dailyWorkQueue: [],
    throughput: [],
    mailboxDomainHealth: null,
    autonomousReadiness: null,
    ...overrides,
  }
}

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-13a",
  completedAt: new Date().toISOString(),
  companiesReviewed: 22,
  researchCompleted: 22,
  buyingSignalsVerified: 3,
  readyForOutreachReview: 1,
  qualificationCompleted: 3,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 22 companies.",
  leadResults: [
    {
      leadId: "lead-precision",
      companyName: "Precision Biomedical",
      outcome: "completed",
      readyForOutreachReview: true,
      hasBuyingSignals: true,
      qualificationStatus: "completed",
    },
  ],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 2,
      callsToday: 0,
      openOpportunities: 2,
      hotCompanies: 3,
      approvalQueueCount: 2,
    },
    meetings: { today: 1, thisWeek: 2, scheduled: 2 },
    inbox: { repliesNeedingAttention: 2, threadsOpen: 1, newReplies: 2 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 4 },
    avaConsole: {
      greeting: "Good morning, Mike.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Continue researching medical equipment companies",
      researchLoopSummary: researchSummary,
    },
    dashboard: {
      generatedAt: new Date().toISOString(),
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
  }
}

function main(): void {
  console.log(`[${PHASE}] Ava Operating Rhythm certification`)

  assert.equal(GROWTH_OPERATING_RHYTHM_QA_MARKER, "ge-aios-13a-operating-rhythm-v1")

  const rhythmFiles = [
    "lib/growth/operating-rhythm/types.ts",
    "lib/growth/operating-rhythm/index.ts",
    "lib/growth/operating-rhythm/planner/build-operating-rhythm.ts",
    "lib/growth/operating-rhythm/engine/run-operating-rhythm.ts",
    "lib/growth/operating-rhythm/bridges/work-manager-bridge.ts",
    "lib/growth/operating-rhythm/bridges/narrative-bridge.ts",
    "lib/growth/operating-rhythm/bridges/memory-bridge.ts",
    "lib/growth/operating-rhythm/rhythms/morning-planning.ts",
    "lib/growth/operating-rhythm/rhythms/research-cycle.ts",
    "lib/growth/operating-rhythm/rhythms/qualification-cycle.ts",
    "lib/growth/operating-rhythm/rhythms/outreach-cycle.ts",
    "lib/growth/operating-rhythm/rhythms/inbox-cycle.ts",
    "lib/growth/operating-rhythm/rhythms/approval-cycle.ts",
    "lib/growth/operating-rhythm/rhythms/reflection-cycle.ts",
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
  ]
  for (const file of rhythmFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const operatingRhythmIndex = readSource("lib/growth/operating-rhythm/index.ts")
  assert.doesNotMatch(operatingRhythmIndex, /scheduler\/prioritize-work-items/)
  assert.doesNotMatch(readSource("lib/growth/operating-rhythm/engine/run-operating-rhythm.ts"), /executeReadyWorkItems|sendEmail|outbound/)

  const futureHooks = [
    startMorningPlanning(),
    continueCurrentPhase(),
    pauseCurrentPhase(),
    resumeCurrentPhase(),
    runEndOfDayReflection(),
  ]
  for (const hook of futureHooks) {
    assert.equal(Object.values(hook)[0], false)
    assert.equal(Object.values(hook)[1], "planning_only")
  }

  const input = {
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [
      { id: "w1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1", severity: 3 },
      { id: "w2", label: "Approve outreach draft for XYZ Equipment", detail: "Ready", href: "/growth/leads/2", severity: 2 },
    ],
    dailyWorkQueue: [
      {
        id: "q1",
        priority: "high" as const,
        companyName: "Precision Biomedical",
        actionLabel: "Prepare outreach",
        href: "/growth/leads/precision",
        confidencePercent: 88,
        confidenceLabel: "High",
        requiresHumanApproval: true,
      },
    ],
    accomplishments: [],
    timeline: [],
    generatedAt: "2026-07-08T12:00:00.000Z",
  }

  const workResult = runWorkManager(input)
  const decisionResult = runDecisionEngine(input)
  assert.ok(decisionResult.next_best_actions.length > 0, "Decision Engine must feed Work Manager stack")

  const metrics = {
    researched: 22,
    qualified: 3,
    readyForReview: 1,
    repliesToday: 2,
    meetingsToday: 1,
    approvalsWaiting: 2,
  }

  const rhythmA = runOperatingRhythm({ hour: 9, workResult, metrics, sinceYesterday: ["Received 1 reply since yesterday."] })
  const rhythmB = runOperatingRhythm({ hour: 9, workResult, metrics, sinceYesterday: ["Received 1 reply since yesterday."] })

  assert.deepEqual(
    rhythmA.phase_timeline.map((row) => `${row.id}:${row.status}`),
    rhythmB.phase_timeline.map((row) => `${row.id}:${row.status}`),
    "Phase timeline must be deterministic",
  )
  assert.equal(rhythmA.phase_timeline.length, AVA_OPERATING_PHASE_ORDER.length)
  assert.ok(rhythmA.today_plan.length > 0)
  assert.ok(rhythmA.waiting_on_operator.length >= 2)

  const eveningRhythm = buildOperatingRhythm({
    hour: 18,
    workResult: { ...workResult, operator_queue: [], interruptions: [], active_work: null },
    metrics,
    sinceYesterday: [],
  })
  assert.equal(eveningRhythm.current_phase, "reflection")

  const morningRhythm = buildOperatingRhythm({
    hour: 8,
    workResult: { ...workResult, operator_queue: [], interruptions: [], active_work: null },
    metrics,
  })
  assert.equal(morningRhythm.current_phase, "morning_planning")

  const storyBlocks = buildOperatingRhythmStoryBlocks(rhythmA, workResult, 9)
  assert.ok(storyBlocks.length >= 1)
  assert.match(storyBlocks[0]?.text ?? "", /overnight|plan|research|approval|waiting/i)

  const memory = buildOperatingRhythmMemory({
    rhythm: eveningRhythm,
    workResult,
    risks: ["Reply backlog growing"],
    wins: ["Qualified 3 companies"],
  })
  assert.ok(memory.accomplishments.length >= 0)
  assert.ok(Array.isArray(memory.tomorrow_plan))
  assert.ok(Array.isArray(memory.unfinished_work))

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
  })
  assert.equal(briefing.operating_rhythm_qa_marker, GROWTH_OPERATING_RHYTHM_QA_MARKER)
  assert.ok(briefing.operating_rhythm_result)
  assert.ok(briefing.work_manager_result)
  assert.ok(briefing.story_blocks.some((block) => /overnight|plan|approval|waiting|research/i.test(block.text)))

  const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrativeSource, /runOperatingRhythm/)
  assert.match(narrativeSource, /runWorkManager/)
  assert.match(narrativeSource, /buildOperatingRhythmStoryBlocks/)
  assert.doesNotMatch(narrativeSource, /runDecisionEngine/)
  assert.doesNotMatch(narrativeSource, /buildWorkManagerStoryBlocks/)

  const plannerSource = readSource("lib/growth/operating-rhythm/planner/build-operating-rhythm.ts")
  assert.doesNotMatch(plannerSource, /runDecisionEngine|rankNextActions|scoreDecisionCandidate/)
  assert.match(plannerSource, /buildTodayPlanFromWorkManager/)

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: baseAiOsUx({
      approveItemsCount: 2,
      waitingOnYou: input.waitingOnYou,
      dailyWorkQueue: input.dailyWorkQueue,
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 2,
    workspaceSummary: workspaceSummaryFixture(),
  })
  assert.ok(hero.operatingRhythm)
  assert.equal(hero.operatingRhythm?.qaMarker, GROWTH_OPERATING_RHYTHM_QA_MARKER)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeAvaOperatingRhythmSection/)
  assert.match(dashboardSource, /writeOperatingRhythmMemory/)
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaHeroSection") <
      dashboardSource.indexOf("<GrowthHomeAvaOperatingRhythmSection"),
  )
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaOperatingRhythmSection") <
      dashboardSource.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const uiSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
  )
  assert.match(uiSource, /AVA_OPERATING_RHYTHM_TODAY_PROGRESS_TITLE/)
  assert.match(uiSource, /phase_timeline/)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const recentMigrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.includes("operating_rhythm") || name.includes("operating-rhythm"))
  assert.equal(recentMigrations.length, 0, "13A must not add schema migrations")

  console.log(`[${PHASE}] PASS — Operating Rhythm certified (local)`)
}

main()
