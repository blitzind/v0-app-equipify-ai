/**
 * GE-AIOS-14B — AI OS Integration & Legacy Consolidation certification.
 * Run: pnpm test:ge-aios-14b-ai-os-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER } from "../lib/growth/ava-home/narrative"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-14B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
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
  runId: "run-14b",
  completedAt: new Date().toISOString(),
  companiesReviewed: 12,
  researchCompleted: 12,
  buyingSignalsVerified: 2,
  readyForOutreachReview: 1,
  qualificationCompleted: 2,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 12 companies.",
  leadResults: [],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 1,
      callsToday: 0,
      openOpportunities: 2,
      hotCompanies: 2,
      approvalQueueCount: 1,
    },
    meetings: { today: 0, thisWeek: 1, scheduled: 1 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 1, newReplies: 1 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 3 },
    avaConsole: {
      greeting: "Good morning, Mike.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Continue researching companies",
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
  console.log(`[${PHASE}] AI OS Integration & Legacy Consolidation certification`)

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /buildAvaDailyBriefing/)
  assert.match(heroSource, /buildPrimaryDecisionFromWorkManager/)
  assert.doesNotMatch(heroSource, /fetch\(/)

  const heroUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroUi, /storyBlocks\.filter/)
  assert.match(heroUi, /hero\.storyBlocks \?\? \[\]/)
  assert.doesNotMatch(heroUi, /GROWTH_HOME_AVA_CURRENTLY_TITLE/)
  assert.doesNotMatch(heroUi, /briefingNarrative\.map/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /buildAvaHomeHero/)
  assert.match(dashboard, /readAvaNarrativeMetricsSnapshot/)
  assert.match(dashboard, /writeAvaNarrativeMetricsSnapshot/)
  assert.match(dashboard, /resolvePersistedOrganizationalMemoryStore/)
  assert.match(dashboard, /writeOrganizationalMemoryStore/)
  assert.match(dashboard, /readOperatingRhythmMemory/)
  assert.match(dashboard, /writeOperatingRhythmMemory/)
  assert.match(dashboard, /GrowthHomeAvaWorkSection/)
  assert.match(dashboard, /GrowthHomeAvaOperatingRhythmSection/)
  assert.match(dashboard, /GrowthHomeAvaMemorySection/)
  assert.match(dashboard, /GrowthHomeAvaSpecialistTeamSection/)
  assert.doesNotMatch(dashboard, /GrowthHomeDailyWorkQueueSection/)
  assert.doesNotMatch(dashboard, /GrowthHomeDailyBriefingSection/)
  assert.doesNotMatch(dashboard, /fetch\(/)

  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaHeroSection") < dashboard.indexOf("<GrowthHomeAvaWorkSection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaWorkSection") <
      dashboard.indexOf("<GrowthHomeAvaOperatingRhythmSection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaOperatingRhythmSection") <
      dashboard.indexOf("<GrowthHomeAvaMemorySection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaMemorySection") <
      dashboard.indexOf("<GrowthHomeAvaSpecialistTeamSection"),
  )
  assert.ok(
    dashboard.indexOf("<GrowthHomeAvaSpecialistTeamSection") <
      dashboard.indexOf("<GrowthHomeExecutiveSnapshotSection"),
  )

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /workspaceSummary/)
  assert.equal((hook.match(/fetch\(/g) ?? []).length, 1)

  const body = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(body, /workspaceSummary=\{workspaceSummary\}/)

  const engine = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(engine, /runMemoryEngine/)
  assert.match(engine, /runWorkManager/)
  assert.match(engine, /runOperatingRhythm/)

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: baseAiOsUx({
      waitingOnYou: [{ id: "1", label: "Approve outreach", detail: "Ready", href: "/growth/leads/1" }],
      approveItemsCount: 1,
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [{ id: "1", label: "Approve outreach", detail: "Ready", href: "/growth/leads/1" }],
    dailyWorkQueue: [],
    timeline: [],
  })

  assert.equal(hero.dailyBriefing?.qaMarker, GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER)
  assert.ok(hero.workManager)
  assert.ok(hero.operatingRhythm)
  assert.ok(hero.memorySummary)
  assert.ok(hero.storyBlocks.length >= 1)
  assert.deepEqual(hero.briefingNarrative, hero.storyBlocks.map((block) => block.text))

  console.log(`[${PHASE}] PASS — AI OS integration consolidated (local)`)
}

main()
