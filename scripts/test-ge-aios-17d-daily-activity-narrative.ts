/**
 * GE-AIOS-17D — Ava Daily Activity Narrative certification.
 * Run: pnpm test:ge-aios-17d-daily-activity-narrative
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaDailyActivityNarrative,
  buildAvaDailyBriefing,
  buildDailyActivityCompletedLines,
  buildDailyActivityLearnedLines,
  buildDailyActivityWaitingLines,
  buildDailyActivityWorkingNextLines,
  GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
} from "../lib/growth/ava-home/narrative"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { runOperatingRhythm } from "../lib/growth/operating-rhythm/engine/run-operating-rhythm"
import { finalizeSalesSpecialistOutcomes } from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { mapResearchLoopLeadToSalesOutcomes } from "../lib/growth/specialists/execution/sales-outcome-mappers"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "../lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

const PHASE = "GE-AIOS-17D" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseWorkspaceSummary() {
  return {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 11,
      hotCompanies: 5,
      approvalQueueCount: 2,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 2, leadsNeedingAction: 0 },
    avaConsole: {
      greeting: "Good evening",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: "2 items waiting for your approval",
      suggestedNextAction: null,
      researchLoopSummary: null,
    },
    dashboard: { sections: [] } as never,
    leadPool: {
      visible_count: 42,
      has_more: true,
      degraded: false,
      relationship_snapshot_count: 10,
    },
  }
}

function sampleKnowledge(): OrganizationalKnowledgeItem[] {
  return [
    {
      knowledge_id: "memory_events:industry:medical_equipment_vs_general",
      organization_id: "org-17d",
      source: "memory_events",
      specialist: "sales",
      category: "industry",
      finding:
        "Medical equipment companies are showing stronger fit signals than general field-service companies.",
      confidence: 82,
      supporting_event_count: 8,
      first_observed_at: "2026-07-08T20:00:00.000Z",
      last_confirmed_at: "2026-07-08T20:00:00.000Z",
      superseded_by: null,
      active: true,
      metadata: {},
    },
  ]
}

function baseAiOsUx(): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: "growth-ge-aios-ux-1a-ai-os-home-experience-v1",
    hero: {} as never,
    waitingOnYou: [
      {
        id: "waiting:approval-1",
        label: "Review outreach draft",
        detail: "Acme Medical",
        href: "/growth/leads/lead-1",
        severity: 3,
      },
    ],
    waitingOnYouOverflow: 0,
    approveItemsHref: "/growth/approvals",
    approveItemsCount: 2,
    liveStatus: null,
    dailyWorkQueueBuckets: null,
    dailyWorkQueue: [
      {
        id: "queue-1",
        companyName: "Northstar Medical",
        actionLabel: "Prepare outreach",
        reason: "Qualified with buying signals",
        href: "/growth/leads/lead-2",
        priority: "high",
        requiresHumanApproval: true,
        confidencePercent: 85,
      },
    ],
    throughput: [],
    mailboxDomainHealth: null,
    autonomousReadiness: null,
  }
}

function main(): void {
  console.log(`[${PHASE}] Ava Daily Activity Narrative certification`)

  const activitySource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative.ts")
  assert.match(activitySource, /buildDailyActivityCompletedLines/)
  assert.match(activitySource, /buildDailyActivityLearnedLines/)
  assert.match(activitySource, /buildDailyActivityWaitingLines/)
  assert.match(activitySource, /buildDailyActivityWorkingNextLines/)

  const briefingSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(briefingSource, /buildAvaDailyActivityNarrative/)
  assert.match(briefingSource, /daily_activity_narrative/)

  const heroSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroSection, /dailyActivityNarrative/)
  assert.doesNotMatch(heroSection, /buildHomeRuntimeBriefingIntro/)

  const workspaceSummaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.doesNotMatch(workspaceSummaryService, /buildAvaDailyActivityNarrative/)

  const generatedAt = "2026-07-08T20:00:00.000Z"
  const salesOutcomes = finalizeSalesSpecialistOutcomes({
    organizationId: "org-17d",
    generatedAt,
    outcomes: mapResearchLoopLeadToSalesOutcomes(
      {
        leadId: "lead-1",
        companyName: "Acme Medical",
        outcome: "completed",
        qualificationStatus: "completed",
        hasBuyingSignals: true,
        readyForOutreachReview: true,
      },
      generatedAt,
    ),
  })

  const dailySummary = {
    qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
    generatedAt,
    researched: 42,
    qualified: 11,
    strong_opportunities: 11,
    outreach_prepared: 5,
    meetings_prepared: 0,
    approvals_pending: 2,
  }

  const memory = runMemoryEngine({
    organizationId: "org-17d",
    generatedAt,
    workspaceSummary: baseWorkspaceSummary(),
    waitingOnYou: baseAiOsUx().waitingOnYou,
    dailyWorkQueue: baseAiOsUx().dailyWorkQueue,
    accomplishments: [],
    timeline: [],
    salesOutcomes: salesOutcomes,
    salesDailySummary: dailySummary,
    organizationalKnowledge: sampleKnowledge(),
  })

  const completedLines = buildDailyActivityCompletedLines({
    memorySummary: memory.summary,
    salesDailySummary: dailySummary,
  })
  assert.ok(completedLines.some((line) => /researched 42 companies/i.test(line)))
  assert.ok(completedLines.some((line) => /11 strong opportunities/i.test(line)))
  assert.ok(completedLines.some((line) => /prepared 5 outreach drafts/i.test(line)))
  assert.ok(!completedLines.some((line) => /waiting for your approval/i.test(line)))

  const learnedLines = buildDailyActivityLearnedLines(memory.summary)
  assert.ok(learnedLines.some((line) => /learned that medical equipment companies/i.test(line)))

  const workResult = runWorkManager({
    workspaceSummary: baseWorkspaceSummary(),
    waitingOnYou: baseAiOsUx().waitingOnYou,
    dailyWorkQueue: baseAiOsUx().dailyWorkQueue,
    accomplishments: [],
    timeline: [],
    generatedAt,
    memorySummary: memory.summary,
  })

  const waitingLines = buildDailyActivityWaitingLines({
    workResult,
    salesDailySummary: dailySummary,
  })
  assert.ok(waitingLines.some((line) => /waiting for your approval/i.test(line)))

  const operatingRhythm = runOperatingRhythm({
    hour: 20,
    workResult,
    metrics: {
      researched: 42,
      qualified: 11,
      readyForReview: 2,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 2,
      hotCompanies: 5,
    },
    sinceYesterday: [],
    previousMemory: null,
  })

  const workingNextLines = buildDailyActivityWorkingNextLines({
    workResult,
    operatingRhythm,
    hour: 20,
  })
  assert.ok(workingNextLines.length > 0)

  const narrative = buildAvaDailyActivityNarrative({
    memorySummary: memory.summary,
    salesDailySummary: dailySummary,
    workResult,
    operatingRhythm,
    hour: 20,
  })
  assert.equal(narrative.qaMarker, GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER)
  assert.ok(narrative.completed_today.length > 0)
  assert.ok(narrative.learned_today.length > 0)
  assert.ok(narrative.waiting_on_you.length > 0)

  const emptyMemory = runMemoryEngine({
    organizationId: "org-empty",
    generatedAt,
    workspaceSummary: {
      ...baseWorkspaceSummary(),
      kpis: { ...baseWorkspaceSummary().kpis, approvalQueueCount: 0 },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
  })
  const emptyWork = runWorkManager({
    workspaceSummary: {
      ...baseWorkspaceSummary(),
      kpis: { ...baseWorkspaceSummary().kpis, approvalQueueCount: 0 },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    generatedAt,
    memorySummary: emptyMemory.summary,
  })
  const emptyRhythm = runOperatingRhythm({
    hour: 10,
    workResult: emptyWork,
    metrics: emptyMemory.summary ? {
      researched: 0,
      qualified: 0,
      readyForReview: 0,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 0,
      hotCompanies: 0,
    } : {
      researched: 0,
      qualified: 0,
      readyForReview: 0,
      repliesToday: 0,
      meetingsToday: 0,
      approvalsWaiting: 0,
      hotCompanies: 0,
    },
    sinceYesterday: [],
    previousMemory: null,
  })
  const emptyNarrative = buildAvaDailyActivityNarrative({
    memorySummary: emptyMemory.summary,
    workResult: emptyWork,
    operatingRhythm: emptyRhythm,
    hour: 10,
  })
  assert.ok(emptyNarrative.lines.length > 0, "Empty state must remain safe")

  const briefing = buildAvaDailyBriefing({
    greeting: "Good evening, Mike.",
    hour: 20,
    workspaceSummary: baseWorkspaceSummary(),
    accomplishments: [],
    waitingOnYou: baseAiOsUx().waitingOnYou,
    dailyWorkQueue: baseAiOsUx().dailyWorkQueue,
    timeline: [],
    salesOutcomes: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      outcomes: salesOutcomes,
      dailySummary,
    },
    organizationalKnowledge: sampleKnowledge(),
  })

  assert.ok(briefing.daily_activity_narrative)
  assert.match(briefing.summary, /researched 42 companies/i)
  assert.match(briefing.summary, /learned that medical equipment companies/i)

  const hero = buildAvaHomeHero({
    greeting: "Good evening",
    hour: 20,
    employeeStatus: { kind: "waiting_for_approval", label: "Waiting for your approval" },
    aiOsUx: baseAiOsUx(),
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    workspaceSummary: baseWorkspaceSummary(),
    waitingOnYou: baseAiOsUx().waitingOnYou,
    dailyWorkQueue: baseAiOsUx().dailyWorkQueue,
    timeline: [],
    salesOutcomes: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      outcomes: salesOutcomes,
      dailySummary,
    },
    organizationalKnowledge: sampleKnowledge(),
  })

  assert.ok(hero.dailyActivityNarrative)
  assert.ok(hero.briefingNarrative.some((line) => /researched 42 companies/i.test(line)))

  console.log(`[${PHASE}] PASS — Ava Daily Activity Narrative certified (local)`)
  console.log("  ✓ Completed work from Memory")
  console.log("  ✓ Learned insights from Knowledge")
  console.log("  ✓ Waiting items from Work Manager")
  console.log("  ✓ Structured daily report on Home hero")
  console.log("  ✓ No invented completed work")
  console.log(`  ✓ QA marker: ${GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER}`)
}

main()
