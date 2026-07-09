/**
 * GE-AIOS-12A — Ava Organizational Memory certification.
 * Run: pnpm test:ge-aios-12a-memory-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import { AVA_NARRATIVE_SNAPSHOT_STORAGE_KEY } from "../lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { scoreConfidence } from "../lib/growth/decision-engine/scoring/confidence-score"
import {
  AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY,
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  applyMemoryConfidenceBoost,
  buildMemoryNarrativeLines,
  buildWhatIveLearnedBullets,
  detectMemoryPatterns,
  forgetMemory,
  rememberConversation,
  rememberOutcome,
  rememberPreference,
  runMemoryEngine,
} from "../lib/growth/memory"
import { AVA_OPERATING_RHYTHM_MEMORY_KEY } from "../lib/growth/operating-rhythm"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-12A" as const

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
  runId: "run-12a",
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
  console.log(`[${PHASE}] Ava Organizational Memory certification`)

  assert.equal(GROWTH_MEMORY_ENGINE_QA_MARKER, "ge-aios-12a-memory-engine-v1")
  assert.equal(AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY, "equipify:ava-organizational-memory/v1")

  const memoryFiles = [
    "lib/growth/memory/types.ts",
    "lib/growth/memory/index.ts",
    "lib/growth/memory/events/record-memory-event.ts",
    "lib/growth/memory/timeline/organization-memory-timeline.ts",
    "lib/growth/memory/summaries/summarize-memory-period.ts",
    "lib/growth/memory/preferences/organization-preferences.ts",
    "lib/growth/memory/patterns/detect-patterns.ts",
    "lib/growth/memory/bridges/business-intelligence-memory.ts",
    "lib/growth/memory/bridges/decision-memory.ts",
    "lib/growth/memory/bridges/narrative-memory.ts",
    "lib/growth/memory/engine/run-memory-engine.ts",
    "components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx",
  ]
  for (const file of memoryFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const futureHooks = [
    rememberConversation(),
    rememberOutcome(),
    rememberPreference(),
    forgetMemory(),
  ]
  for (const hook of futureHooks) {
    assert.equal(Object.values(hook)[0], false)
    assert.equal(Object.values(hook)[1], "deterministic_only")
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
    accomplishments: [
      {
        id: "acc-1",
        title: "Since your last visit",
        items: ["Five companies qualified.", "Meeting booked."],
      },
    ],
    timeline: [],
    generatedAt: "2026-07-08T12:00:00.000Z",
  }

  const memoryA = runMemoryEngine({ ...input, organizationId: "org-12a" })
  const memoryB = runMemoryEngine({ ...input, organizationId: "org-12a" })

  assert.deepEqual(
    memoryA.summary.recent_events.map((row) => row.id).sort(),
    memoryB.summary.recent_events.map((row) => row.id).sort(),
    "Memory events must be deterministic",
  )
  assert.ok(memoryA.summary.preferences.length >= 3)
  assert.ok(memoryA.summary.learned_insights.length >= 1)
  assert.ok(memoryA.summary.timeline.length >= 1)

  const patterns = detectMemoryPatterns(memoryA.store.events)
  assert.ok(patterns.some((row) => /research|medical|approval|software/i.test(row.label)))

  const decisionWithoutMemory = runDecisionEngine(input)
  const decisionWithMemory = runDecisionEngine({ ...input, memorySummary: memoryA.summary })
  assert.ok(decisionWithMemory.context.memorySummary)
  assert.ok(decisionWithMemory.next_best_actions.length > 0)

  const medicalCandidate = decisionWithMemory.next_best_actions.find((row) =>
    /biomedical|medical|precision/i.test(row.title),
  )
  if (medicalCandidate) {
    const withoutBoost = decisionWithoutMemory.next_best_actions.find((row) => row.id === medicalCandidate.id)
    assert.ok(
      !withoutBoost || medicalCandidate.confidence >= withoutBoost.confidence,
      "Memory should not reduce confidence for historically strong segments",
    )
  }

  const candidate = decisionWithMemory.context.research[0]
  if (candidate) {
    const boost = applyMemoryConfidenceBoost(candidate, decisionWithMemory.context)
    assert.ok(boost >= 0)
    const confidence = scoreConfidence(candidate, decisionWithMemory.context)
    assert.ok(confidence >= 0 && confidence <= 100)
  }

  const workResult = runWorkManager({ ...input, memorySummary: memoryA.summary })
  assert.ok(workResult.work_plan.length >= 1)

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
    generatedAt: input.generatedAt,
    organizationId: "org-12a",
  })
  assert.equal(briefing.memory_qa_marker, GROWTH_MEMORY_ENGINE_QA_MARKER)
  assert.ok(briefing.memory_result)
  assert.ok(briefing.memory_store)
  assert.ok(
    briefing.story_blocks.some((block) => /learned|medical|month|week|research/i.test(block.text)) ||
      buildMemoryNarrativeLines(briefing.memory_result).length > 0,
  )

  const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrativeSource, /runMemoryEngine/)
  assert.match(narrativeSource, /buildMemoryStoryBlocks/)
  assert.match(narrativeSource, /memorySummary/)
  assert.doesNotMatch(narrativeSource, /runDecisionEngine/)

  const decisionSource = readSource("lib/growth/decision-engine/scoring/confidence-score.ts")
  assert.match(decisionSource, /applyMemoryConfidenceBoost/)

  const workManagerSource = readSource("lib/growth/work-manager/manager/run-work-manager.ts")
  assert.match(workManagerSource, /memorySummary/)

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
    accomplishments: input.accomplishments,
    repliesWaiting: 2,
    workspaceSummary: workspaceSummaryFixture(),
  })
  assert.ok(hero.memorySummary)
  assert.equal(hero.memorySummary?.qaMarker, GROWTH_MEMORY_ENGINE_QA_MARKER)

  const bullets = buildWhatIveLearnedBullets(hero.memorySummary)
  assert.ok(bullets.length <= 3)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeAvaMemorySection/)
  assert.match(dashboardSource, /resolvePersistedOrganizationalMemoryStore/)
  assert.match(dashboardSource, /writeOrganizationalMemoryStore/)
  assert.match(dashboardSource, /readOperatingRhythmMemory/)
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaOperatingRhythmSection") <
      dashboardSource.indexOf("<GrowthHomeAvaMemorySection"),
  )
  assert.ok(
    dashboardSource.indexOf("<GrowthHomeAvaMemorySection") <
      dashboardSource.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const memoryEngineSource = readSource("lib/growth/memory/engine/run-memory-engine.ts")
  assert.doesNotMatch(memoryEngineSource, /openai|anthropic|generateText|llm/i)
  assert.doesNotMatch(memoryEngineSource, /executeReadyWorkItems|sendEmail|outbound/)

  const narrativeSnapshotSource = readSource("lib/growth/ava-home/narrative/context/ava-narrative-snapshot-memory.ts")
  assert.match(narrativeSnapshotSource, /equipify:ava-narrative:snapshot\/v1/)
  const operatingRhythmMemorySource = readSource("lib/growth/operating-rhythm/bridges/memory-bridge.ts")
  assert.match(operatingRhythmMemorySource, /equipify:ava-operating-rhythm:memory\/v1/)
  assert.doesNotMatch(readSource("lib/growth/memory/types.ts"), /equipify:ava-narrative:snapshot\/v1/)
  assert.doesNotMatch(readSource("lib/growth/memory/types.ts"), /equipify:ava-operating-rhythm:memory\/v1/)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const memoryMigrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.includes("ava_organizational_memory") || name.includes("ava-organizational-memory"))
  assert.equal(memoryMigrations.length, 0, "12A must not add schema migrations")

  console.log(`[${PHASE}] PASS — Organizational Memory certified (local)`)
}

main()
