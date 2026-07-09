/**
 * GE-AIOS-HOTFIX-16X-1 — Home runtime undefined array crash certification.
 * Run: pnpm test:ge-aios-hotfix-16x-home-runtime-undefined-arrays
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaHomeHero, GROWTH_HOME_AVA_HERO_7A_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { enrichGrowthHomeWaitingOnYouItems } from "../lib/growth/home/growth-home-runtime-presenter"
import {
  emptyGrowthHomeLeadPoolSummary,
  emptyGrowthHomeRelationshipSnapshots,
  GROWTH_HOME_RUNTIME_HOTFIX_16X_1_QA_MARKER,
  normalizeAvaSpecialistOrchestratorResult,
  normalizeAvaWorkManagerResult,
  normalizeGrowthHomeAiOsUxViewModel,
  normalizeGrowthHomeAvaHeroViewModel,
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "../lib/growth/home/growth-home-runtime-safe-defaults"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-HOTFIX-16X-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

/** Ensure every GROWTH_*_QA_MARKER used in a Home client component is imported in that file. */
function assertHomeClientQaMarkerImports(relativePath: string): void {
  const source = readSource(relativePath)
  const markerPattern = /GROWTH_[A-Z0-9_]*_QA_MARKER/g
  const importBlocks = source.match(/^import[\s\S]*?from\s+["'][^"']+["']\s*\n/gm) ?? []
  const importSource = importBlocks.join("\n")
  const body = source.replace(/^import[\s\S]*?from\s+["'][^"']+["']\s*\n/gm, "")

  const used = new Set<string>()
  for (const match of body.matchAll(markerPattern)) {
    used.add(match[0])
  }

  for (const marker of used) {
    assert.match(
      importSource,
      new RegExp(`\\b${marker}\\b`),
      `${relativePath} uses ${marker} but does not import it`,
    )
  }
}

function baseAiOsUx(overrides: Partial<GrowthHomeAiOsUxViewModel> = {}): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
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
    ...overrides,
  }
}

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-hotfix",
  completedAt: new Date().toISOString(),
  companiesReviewed: 0,
  researchCompleted: 0,
  buyingSignalsVerified: 0,
  readyForOutreachReview: 0,
  qualificationCompleted: 0,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "",
  leadResults: [],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 0,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
    avaConsole: {
      greeting: "Good morning.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: null,
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
  console.log(`[${PHASE}] Home runtime undefined array hotfix certification`)

  assert.equal(
    GROWTH_HOME_RUNTIME_HOTFIX_16X_1_QA_MARKER,
    "ge-aios-hotfix-16x-1-home-runtime-undefined-arrays-v1",
  )

  const partialPayload = normalizeGrowthHomeWorkspaceSummaryPayload({
    ok: true,
    generatedAt: new Date().toISOString(),
    sources: {
      briefing: null,
      leadInboxSections: [],
      cadenceSummary: null,
      pipelineDashboard: null,
      opportunityReadiness: null,
      sequenceFoundation: null,
      sequenceExecution: null,
      engagementWorkspace: null,
      conversationDashboard: null,
      relationshipDashboard: null,
      callsDashboard: null,
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
  } as never)

  assert.ok(partialPayload.leadPool)
  assert.ok(partialPayload.relationshipSnapshots)
  assert.deepEqual(partialPayload.relationshipSnapshots.byLeadId, {})
  assert.equal(partialPayload.leadPool.degraded, true)

  const emptySnapshots = emptyGrowthHomeRelationshipSnapshots()
  const emptyLeadPool = emptyGrowthHomeLeadPoolSummary()
  assert.deepEqual(emptyLeadPool.visible_count, 0)
  assert.deepEqual(emptySnapshots.byLeadId, {})

  const heroWithoutStoryBlocks = normalizeGrowthHomeAvaHeroViewModel({
    qaMarker: GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
    greeting: "Good morning.",
    statusLabel: "Working",
    statusKind: "working",
    currentActivities: undefined as never,
    sinceLastVisit: undefined as never,
    primaryDecision: null,
    additionalDecisionCount: 0,
    reviewAllHref: null,
    allNormalLine: "All normal.",
    storyBlocks: undefined as never,
    briefingNarrative: undefined as never,
    workManager: {
      work_plan: undefined,
      blocked: undefined,
      completed_today: undefined,
      operator_queue: undefined,
      all_work_items: undefined,
    } as never,
    specialistOrchestrator: {
      team_status: undefined,
      assignments: undefined,
      routed_work_items: undefined,
    } as never,
  })

  assert.deepEqual(heroWithoutStoryBlocks.storyBlocks, [])
  assert.deepEqual(heroWithoutStoryBlocks.currentActivities, [])
  assert.deepEqual(heroWithoutStoryBlocks.sinceLastVisit, [])
  assert.deepEqual(heroWithoutStoryBlocks.briefingNarrative, [])
  assert.ok(heroWithoutStoryBlocks.workManager)
  assert.deepEqual(heroWithoutStoryBlocks.workManager?.work_plan, [])
  assert.ok(heroWithoutStoryBlocks.specialistOrchestrator)
  assert.deepEqual(heroWithoutStoryBlocks.specialistOrchestrator?.team_status, [])

  heroWithoutStoryBlocks.storyBlocks.filter(() => true)
  heroWithoutStoryBlocks.briefingNarrative.map(() => "")

  const waitingEnriched = enrichGrowthHomeWaitingOnYouItems(undefined, {})
  assert.deepEqual(waitingEnriched, [])

  const partialAiOsUx = normalizeGrowthHomeAiOsUxViewModel(
    baseAiOsUx({
      waitingOnYou: undefined as never,
      dailyWorkQueue: undefined as never,
      throughput: undefined as never,
      waitingOnYouOverflow: undefined as never,
      approveItemsCount: undefined as never,
    }),
  )
  assert.deepEqual(partialAiOsUx.waitingOnYou, [])
  assert.deepEqual(partialAiOsUx.dailyWorkQueue, [])
  assert.deepEqual(partialAiOsUx.throughput, [])
  assert.equal(partialAiOsUx.waitingOnYouOverflow, 0)
  assert.equal(partialAiOsUx.approveItemsCount, 0)

  const partialWorkManager = normalizeAvaWorkManagerResult({
    work_plan: undefined,
    blocked: undefined,
    completed_today: undefined,
    operator_queue: undefined,
    all_work_items: undefined,
  } as never)
  assert.ok(partialWorkManager)
  partialWorkManager!.work_plan.filter(() => true)
  partialWorkManager!.blocked.map(() => "")
  partialWorkManager!.operator_queue.slice(0, 1)

  const partialOrchestrator = normalizeAvaSpecialistOrchestratorResult({
    team_status: undefined,
    assignments: undefined,
    routed_work_items: undefined,
  } as never)
  assert.ok(partialOrchestrator)
  partialOrchestrator!.team_status.map(() => "")

  const fullHero = normalizeGrowthHomeAvaHeroViewModel(
    buildAvaHomeHero({
      greeting: "Good morning, Mike.",
      hour: 9,
      employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
      aiOsUx: baseAiOsUx(),
      researchLoopSummary: researchSummary,
      accomplishments: [],
      repliesWaiting: 0,
      workspaceSummary: workspaceSummaryFixture(),
      waitingOnYou: [],
      dailyWorkQueue: [],
      timeline: [],
    }),
  )
  assert.ok(Array.isArray(fullHero.storyBlocks))
  fullHero.storyBlocks.filter(() => true)

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /normalizeGrowthHomeWorkspaceSummaryPayload/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.equal((hook.match(/fetch\(/g) ?? []).length, 1)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /normalizeGrowthHomeAvaHeroViewModel/)
  assert.match(dashboard, /normalizeGrowthHomeAiOsUxViewModel/)
  assert.doesNotMatch(dashboard, /fetch\(/)

  const heroUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroUi, /hero\.storyBlocks \?\? \[\]/)
  assert.match(heroUi, /storyBlocks\.filter/)

  const workUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx")
  assert.match(workUi, /normalizeAvaWorkManagerResult/)

  const rhythmUi = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
  )
  assert.match(rhythmUi, /data-qa-section="home-ava-operating-rhythm"/)
  assert.match(rhythmUi, /buildHomeDefaultOperatingRhythmPhases/)

  const memoryUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx")
  assert.match(memoryUi, /data-qa-section="home-ava-memory"/)
  assert.match(memoryUi, /HOME_RUNTIME_EMPTY_MEMORY_MESSAGE/)

  const teamUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx")
  assert.match(teamUi, /buildHomeDefaultSpecialistTeamStatus/)

  const waitingUi = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(waitingUi, /enrichGrowthHomeWaitingOnYouItems/)
  assert.match(waitingUi, /GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER/)
  assert.doesNotMatch(waitingUi, /GROWTH_HOME_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER/)
  assert.match(
    waitingUi,
    /data-home-experience-2b=\{GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER\}/,
  )

  const homeClientComponents = [
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-operating-rhythm-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-memory-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  ]
  for (const componentPath of homeClientComponents) {
    assertHomeClientQaMarkerImports(componentPath)
  }

  const presenter = readSource("lib/growth/home/growth-home-runtime-presenter.ts")
  assert.match(presenter, /items \?\? \[\]/)

  console.log(`[${PHASE}] PASS — Home renders safely with partial production payloads (local)`)
}

main()
