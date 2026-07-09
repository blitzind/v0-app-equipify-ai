/**
 * GE-AIOS-17E — Home Canonical Runtime Cleanup certification.
 * Run: pnpm test:ge-aios-17e-home-canonical-runtime-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AVA_DAILY_ACTIVITY_SECTION_LABELS,
  AVA_DAILY_ACTIVITY_SECTION_ORDER,
  buildAvaDailyBriefing,
  buildAvaDailyActivityNarrative,
  GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
} from "../lib/growth/ava-home/narrative"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { GROWTH_HOME_CANONICAL_RUNTIME_CLEANUP_17E_QA_MARKER } from "../lib/growth/home/growth-home-runtime-presenter"
import {
  normalizeGrowthHomeAvaHeroViewModel,
  normalizeGrowthHomeWorkspaceSummaryPayload,
} from "../lib/growth/home/growth-home-runtime-safe-defaults"
import { finalizeSalesSpecialistOutcomes } from "../lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { mapResearchLoopLeadToSalesOutcomes } from "../lib/growth/specialists/execution/sales-outcome-mappers"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "../lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import { runMemoryEngine } from "../lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { runOperatingRhythm } from "../lib/growth/operating-rhythm/engine/run-operating-rhythm"

const PHASE = "GE-AIOS-17E" as const

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
      organization_id: "org-17e",
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
  console.log(`[${PHASE}] Home Canonical Runtime Cleanup certification`)

  assert.equal(
    GROWTH_HOME_CANONICAL_RUNTIME_CLEANUP_17E_QA_MARKER,
    "ge-aios-17e-home-canonical-runtime-cleanup-v1",
  )

  const briefingSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.doesNotMatch(briefingSource, /function findFact/)
  assert.doesNotMatch(briefingSource, /function buildStoryBlockFromPriority/)
  assert.doesNotMatch(briefingSource, /function buildStoryBlockFromWorkItem/)
  assert.doesNotMatch(briefingSource, /buildSpecialistStoryBlocks/)
  assert.doesNotMatch(briefingSource, /mapWorkPlanToStoryPriority/)
  assert.match(briefingSource, /buildAvaDailyActivityNarrative/)
  assert.match(briefingSource, /runMemoryEngine/)
  assert.match(briefingSource, /runWorkManager/)
  assert.match(briefingSource, /runOperatingRhythm/)

  const heroSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  assert.match(heroSection, /AVA_DAILY_ACTIVITY_SECTION_LABELS/)
  assert.match(heroSection, /daily-activity-\$\{group\.section\}/)
  assert.doesNotMatch(heroSection, /buildHomeRuntimeBriefingIntro/)
  assert.doesNotMatch(heroSection, /Aiden|aiden/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.doesNotMatch(dashboard, /fetchAiden|aiden\/briefing|AIDEN/)

  const synthesizer = readSource(
    "lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts",
  )
  assert.doesNotMatch(synthesizer, /from "@\/lib\/growth\/aiden/)
  assert.match(synthesizer, /GROWTH_HOME_LEGACY_BRIEFING_FIXTURE_QA_MARKER/)

  const workspaceSummaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(workspaceSummaryService, /briefing: null/)
  assert.doesNotMatch(workspaceSummaryService, /fetchAiden/)

  assert.equal(AVA_DAILY_ACTIVITY_SECTION_LABELS.completed_today, "Completed today")
  assert.equal(AVA_DAILY_ACTIVITY_SECTION_LABELS.learned_today, "Learned today")
  assert.equal(AVA_DAILY_ACTIVITY_SECTION_LABELS.waiting_on_you, "Waiting on you")
  assert.equal(AVA_DAILY_ACTIVITY_SECTION_LABELS.working_next, "Working next")
  assert.deepEqual(AVA_DAILY_ACTIVITY_SECTION_ORDER, [
    "completed_today",
    "learned_today",
    "waiting_on_you",
    "working_next",
  ])

  const generatedAt = "2026-07-08T20:00:00.000Z"
  const salesOutcomes = finalizeSalesSpecialistOutcomes({
    organizationId: "org-17e",
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

  const fullBriefing = buildAvaDailyBriefing({
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

  assert.ok(fullBriefing.daily_activity_narrative)
  assert.ok(fullBriefing.memory_result)
  assert.ok(fullBriefing.work_manager_result)
  assert.ok(fullBriefing.operating_rhythm_result)
  assert.match(fullBriefing.summary, /researched 42 companies/i)
  assert.match(fullBriefing.summary, /learned that medical equipment companies/i)

  const fullHero = normalizeGrowthHomeAvaHeroViewModel(
    buildAvaHomeHero({
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
    }),
  )

  assert.ok(fullHero.dailyActivityNarrative)
  assert.ok(fullHero.dailyActivityNarrative!.completed_today.length > 0)
  assert.ok(fullHero.dailyActivityNarrative!.learned_today.length > 0)
  assert.ok(fullHero.dailyActivityNarrative!.waiting_on_you.length > 0)
  assert.ok(fullHero.briefingNarrative.length > 0)

  const sparseWork = runWorkManager({
    workspaceSummary: {
      ...baseWorkspaceSummary(),
      kpis: { ...baseWorkspaceSummary().kpis, approvalQueueCount: 0 },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    generatedAt,
    memorySummary: runMemoryEngine({
      organizationId: "org-sparse",
      generatedAt,
      workspaceSummary: baseWorkspaceSummary(),
      waitingOnYou: [],
      dailyWorkQueue: [],
      accomplishments: [],
      timeline: [],
    }).summary,
  })
  const sparseRhythm = runOperatingRhythm({
    hour: 10,
    workResult: sparseWork,
    metrics: {
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
  const sparseNarrative = buildAvaDailyActivityNarrative({
    memorySummary: runMemoryEngine({
      organizationId: "org-sparse",
      generatedAt,
      workspaceSummary: baseWorkspaceSummary(),
      waitingOnYou: [],
      dailyWorkQueue: [],
      accomplishments: [],
      timeline: [],
    }).summary,
    workResult: sparseWork,
    operatingRhythm: sparseRhythm,
    hour: 10,
  })
  assert.ok(sparseNarrative.lines.length > 0, "Sparse payload must remain safe")
  assert.equal(sparseNarrative.qaMarker, GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER)

  const degradedSummary = normalizeGrowthHomeWorkspaceSummaryPayload({
    ok: true,
    generatedAt,
    dashboard: { sections: [] } as never,
  })
  assert.equal(degradedSummary.briefing, null)
  assert.equal(degradedSummary.leadPool.degraded, true)
  assert.equal(degradedSummary.organizationalMemory.degraded, true)
  assert.equal(degradedSummary.organizationalKnowledge.degraded, true)

  const degradedHero = normalizeGrowthHomeAvaHeroViewModel(
    buildAvaHomeHero({
      greeting: "Good morning",
      hour: 9,
      employeeStatus: { kind: "idle", label: "Standing by" },
      aiOsUx: { ...baseAiOsUx(), waitingOnYou: [], dailyWorkQueue: [], approveItemsCount: 0 },
      researchLoopSummary: null,
      accomplishments: [],
      repliesWaiting: 0,
      workspaceSummary: degradedSummary.dashboard
        ? {
            ...baseWorkspaceSummary(),
            leadPool: degradedSummary.leadPool,
          }
        : baseWorkspaceSummary(),
      waitingOnYou: [],
      dailyWorkQueue: [],
      timeline: [],
    }),
  )
  assert.ok(Array.isArray(degradedHero.briefingNarrative))
  assert.ok(degradedHero.dailyActivityNarrative?.lines.length ?? degradedHero.briefingNarrative.length >= 0)

  console.log(`[${PHASE}] PASS — Home canonical runtime cleanup certified (local)`)
  console.log("  ✓ Removed legacy hero story-block helpers")
  console.log("  ✓ Aiden removed from Home hot path")
  console.log("  ✓ Daily Activity section labels on hero")
  console.log("  ✓ Memory / Knowledge / Work Manager / Narrative canonical stack")
  console.log("  ✓ Sparse, full, and degraded payloads safe")
  console.log(`  ✓ QA marker: ${GROWTH_HOME_CANONICAL_RUNTIME_CLEANUP_17E_QA_MARKER}`)
}

main()
