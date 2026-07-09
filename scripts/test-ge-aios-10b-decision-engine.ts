/**
 * GE-AIOS-10B — Ava Decision Intelligence Engine certification.
 * Run: pnpm test:ge-aios-10b-decision-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAvaDailyBriefing } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-briefing"
import {
  buildDecisionContext,
  flattenDecisionCandidates,
  GROWTH_DECISION_ENGINE_QA_MARKER,
  rankNextActions,
  runDecisionEngine,
  scoreDecisionCandidate,
} from "../lib/growth/decision-engine"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const PHASE = "GE-AIOS-10B" as const

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
  runId: "run-10b",
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
  console.log(`[${PHASE}] Ava Decision Intelligence Engine certification`)

  assert.equal(GROWTH_DECISION_ENGINE_QA_MARKER, "ge-aios-10b-decision-engine-v1")

  const engineFiles = [
    "lib/growth/decision-engine/index.ts",
    "lib/growth/decision-engine/types.ts",
    "lib/growth/decision-engine/context/build-decision-context.ts",
    "lib/growth/decision-engine/scoring/revenue-impact.ts",
    "lib/growth/decision-engine/scoring/urgency-score.ts",
    "lib/growth/decision-engine/scoring/confidence-score.ts",
    "lib/growth/decision-engine/scoring/dependency-score.ts",
    "lib/growth/decision-engine/scoring/approval-score.ts",
    "lib/growth/decision-engine/scoring/effort-score.ts",
    "lib/growth/decision-engine/ranking/rank-next-actions.ts",
    "lib/growth/decision-engine/recommendations/build-next-best-actions.ts",
    "lib/growth/decision-engine/engine/run-decision-engine.ts",
  ]
  for (const file of engineFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
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
  }

  const context = buildDecisionContext(input)
  assert.ok(context.approvals.length >= 2)
  assert.ok(context.opportunities.length >= 1)
  assert.ok(context.research.length >= 1)

  const candidates = flattenDecisionCandidates(context)
  const rankedA = rankNextActions(candidates, context)
  const rankedB = rankNextActions(candidates, context)

  assert.deepEqual(
    rankedA.map((row) => row.id),
    rankedB.map((row) => row.id),
    "Ranking must be deterministic",
  )
  assert.deepEqual(
    rankedA.map((row) => row.overall_score),
    rankedB.map((row) => row.overall_score),
    "Scores must be deterministic",
  )

  for (const action of rankedA) {
    assert.ok(action.reason.length > 0, `Action ${action.id} must include explainability`)
    assert.ok(action.overall_score >= 0 && action.overall_score <= 100)
    assert.ok(action.score_breakdown.revenue_impact >= 0)
    assert.ok(action.score_breakdown.urgency >= 0)
    assert.ok(action.score_breakdown.confidence >= 0)
  }

  const result = runDecisionEngine(input)
  assert.equal(result.qaMarker, GROWTH_DECISION_ENGINE_QA_MARKER)
  assert.ok(result.next_best_actions.length > 0)
  assert.ok(result.top_action)

  const scored = scoreDecisionCandidate(candidates[0]!, context)
  assert.ok(scored.overall >= 0 && scored.overall <= 100)

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning, Mike.",
    hour: 9,
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
  })
  assert.equal(briefing.work_manager_qa_marker, "ge-aios-11a-work-manager-v1")
  assert.ok(briefing.work_manager_result)

  const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrativeSource, /runWorkManager/)
  assert.match(narrativeSource, /mapWorkPlanToStoryPriority/)

  const hero = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "waiting_for_approval", label: "Waiting", activityLabel: "waiting" },
    aiOsUx: baseAiOsUx({
      approveItemsCount: 2,
      waitingOnYou: input.waitingOnYou,
      dailyWorkQueue: input.dailyWorkQueue,
    }),
    researchLoopSummary: researchSummary,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: workspaceSummaryFixture(),
  })

  assert.ok(hero.workManager)
  assert.ok(hero.primaryDecision)

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /buildPrimaryDecisionFromWorkManager|workManager/)

  const engineSource = readSource("lib/growth/decision-engine/engine/run-decision-engine.ts")
  assert.doesNotMatch(engineSource, /fetch\(|openai|anthropic|llm/i)

  const hookSource = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.equal((hookSource.match(/fetch\(/g) ?? []).length, 1)

  console.log(`[${PHASE}] PASS — Decision Intelligence Engine certified (local)`)
}

main()
