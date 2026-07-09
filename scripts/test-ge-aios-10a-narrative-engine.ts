/**
 * GE-AIOS-10A — Ava Narrative Intelligence Engine certification.
 * Run: pnpm test:ge-aios-10a-narrative-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaDailyBriefing,
  buildAvaNarrativeContext,
  buildSinceYesterdayLines,
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
  prioritizeAvaStories,
} from "../lib/growth/ava-home/narrative"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-10A" as const

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
  runId: "run-10a",
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
      leadId: "lead-1",
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
      repliesToday: 1,
      callsToday: 0,
      openOpportunities: 2,
      hotCompanies: 3,
      approvalQueueCount: 2,
    },
    meetings: { today: 1, thisWeek: 2, scheduled: 2 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 1, newReplies: 1 },
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
  console.log(`[${PHASE}] Ava Narrative Intelligence Engine certification`)

  assert.equal(GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER, "ge-aios-10a-narrative-engine-v1")

  const narrativeFiles = [
    "lib/growth/ava-home/narrative/index.ts",
    "lib/growth/ava-home/narrative/context/build-ava-narrative-context.ts",
    "lib/growth/ava-home/narrative/priorities/prioritize-ava-story.ts",
    "lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts",
    "lib/growth/ava-home/narrative/stories/discovery-story.ts",
    "lib/growth/ava-home/narrative/stories/opportunity-story.ts",
    "lib/growth/ava-home/narrative/stories/approval-story.ts",
    "lib/growth/ava-home/narrative/stories/risk-story.ts",
    "lib/growth/ava-home/narrative/stories/waiting-story.ts",
    "lib/growth/ava-home/narrative/stories/accomplishment-story.ts",
    "lib/growth/ava-home/narrative/copy/narrative-copy.ts",
  ]
  for (const file of narrativeFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const context = buildAvaNarrativeContext({
    workspaceSummary: workspaceSummaryFixture(),
    accomplishments: [],
    waitingOnYou: [
      { id: "1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1" },
      { id: "2", label: "Approve outreach draft for XYZ Equipment", detail: "Ready", href: "/growth/leads/2" },
    ],
    dailyWorkQueue: [
      {
        id: "q1",
        priority: "high",
        companyName: "Precision Biomedical",
        actionLabel: "Prepare outreach",
        href: "/growth/leads/1",
        confidencePercent: 80,
        confidenceLabel: "High",
      },
    ],
    timeline: [],
  })

  assert.equal(context.metrics.researched, 22)
  assert.equal(context.metrics.qualified, 3)
  assert.equal(context.approvalsWaiting.length, 2)
  assert.equal(context.discoveries.length >= 1, true)

  const prioritized = prioritizeAvaStories(context)
  assert.equal(prioritized[0]?.kind, "approval")
  assert.ok(prioritized.some((row) => row.kind === "reply"))
  assert.ok(prioritized.some((row) => row.kind === "meeting"))
  assert.ok(prioritized.some((row) => row.kind === "opportunity"))

  const briefingA = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: workspaceSummaryFixture(),
    accomplishments: [],
    waitingOnYou: [
      { id: "1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1" },
      { id: "2", label: "Approve outreach draft for XYZ Equipment", detail: "Ready", href: "/growth/leads/2" },
    ],
    dailyWorkQueue: [
      {
        id: "q1",
        priority: "high",
        companyName: "Precision Biomedical",
        actionLabel: "Prepare outreach",
        href: "/growth/leads/1",
        confidencePercent: 80,
        confidenceLabel: "High",
      },
    ],
    timeline: [],
  })

  const briefingB = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: workspaceSummaryFixture(),
    accomplishments: [],
    waitingOnYou: [
      { id: "1", label: "Approve outreach draft for ABC Medical", detail: "Ready", href: "/growth/leads/1" },
      { id: "2", label: "Approve outreach draft for XYZ Equipment", detail: "Ready", href: "/growth/leads/2" },
    ],
    dailyWorkQueue: [
      {
        id: "q1",
        priority: "high",
        companyName: "Precision Biomedical",
        actionLabel: "Prepare outreach",
        href: "/growth/leads/1",
        confidencePercent: 80,
        confidenceLabel: "High",
      },
    ],
    timeline: [],
  })

  assert.deepEqual(
    briefingA.story_blocks.map((block) => block.text),
    briefingB.story_blocks.map((block) => block.text),
    "Narrative output must be deterministic",
  )
  assert.ok(briefingA.story_blocks.some((block) => /approval|Approve outreach|overnight|plan|waiting/i.test(block.text)))
  assert.equal(briefingA.work_manager_qa_marker, "ge-aios-11a-work-manager-v1")
  assert.ok(briefingA.work_manager_result)
  assert.ok(briefingA.today_priorities.length > 0)

  const sinceYesterday = buildSinceYesterdayLines(briefingA.metrics_snapshot, {
    capturedAt: new Date(Date.now() - 86_400_000).toISOString(),
    researched: 4,
    qualified: 1,
    readyForReview: 0,
    repliesToday: 0,
    meetingsToday: 0,
    approvalsWaiting: 0,
    opportunitiesCount: 0,
  })
  assert.ok(sinceYesterday.some((line) => /researched 18 additional companies/i.test(line)))
  assert.ok(sinceYesterday.some((line) => /received 1 reply/i.test(line)))

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "waiting_for_approval", label: "Waiting", activityLabel: "waiting" },
    aiOsUx: baseAiOsUx({
      approveItemsCount: 2,
      waitingOnYou: [
        { id: "1", label: "Approve outreach draft", detail: "Ready", href: "/growth/leads/1" },
        { id: "2", label: "Approve outreach draft", detail: "Ready", href: "/growth/leads/2" },
      ],
      dailyWorkQueue: [
        {
          id: "q1",
          priority: "high",
          companyName: "Precision Biomedical",
          actionLabel: "Prepare outreach",
          href: "/growth/leads/1",
          confidencePercent: 80,
          confidenceLabel: "High",
        },
      ],
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: workspaceSummaryFixture(),
  })

  assert.equal(hero.dailyBriefing.qaMarker, GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER)
  assert.deepEqual(
    hero.briefingNarrative,
    hero.storyBlocks.map((block) => block.text),
  )

  const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroSource, /storyBlocks\.map/)
  assert.doesNotMatch(heroSource, /briefingNarrative\.map/)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /buildAvaHomeHero/)
  assert.match(dashboardSource, /readAvaNarrativeMetricsSnapshot/)
  assert.doesNotMatch(dashboardSource, /fetch\(/)

  const hookSource = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hookSource, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  const fetchCount = (hookSource.match(/fetch\(/g) ?? []).length
  assert.equal(fetchCount, 1, "Home must keep a single workspace-summary fetch")

  const engineSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(engineSource, /runWorkManager/)
  assert.match(engineSource, /runMemoryEngine/)
  assert.match(engineSource, /runOperatingRhythm/)
  assert.doesNotMatch(engineSource, /runDecisionEngine/)
  assert.match(engineSource, /AvaNarrativeEnhancer/)
  assert.doesNotMatch(engineSource, /openai|anthropic|generateText|llm/i)

  console.log(`[${PHASE}] PASS — Narrative Intelligence Engine certified (local)`)
}

main()
