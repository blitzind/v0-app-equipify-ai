/**
 * GE-AIOS-18F — Narrative Intelligence certification.
 * Run: pnpm test:ge-aios-18f-narrative-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaDailyActivityNarrative,
  buildAvaDailyBriefing,
  buildDailyActivityCompletedLines,
  buildDailyActivityWorkingNowLines,
  buildDailyActivityWorkingNextLines,
  GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER,
} from "../lib/growth/ava-home/narrative"
import {
  buildNarrativeIntelligenceOpeningLine,
  GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER,
  NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE,
  resolveNarrativeIntelligenceSectionOrder,
} from "../lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_MEMORY_ENGINE_QA_MARKER } from "../lib/growth/memory/types"
import type { OrganizationalKnowledgeItem } from "../lib/growth/memory/knowledge/organization-knowledge-types"
import { GROWTH_OPERATING_RHYTHM_QA_MARKER } from "../lib/growth/operating-rhythm/types"
import { GROWTH_WORK_MANAGER_QA_MARKER } from "../lib/growth/work-manager/types"
import { buildPersonalizedHomeGreeting } from "../lib/growth/home/growth-home-living-experience-18e"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER } from "../lib/growth/specialists/execution/sales-outcome-types"

import { GROWTH_HOME_AI_OS_UX_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

const PHASE = "GE-AIOS-18F" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function knowledgeItem(finding: string): OrganizationalKnowledgeItem {
  const now = new Date().toISOString()
  return {
    knowledge_id: `k-${finding.slice(0, 8)}`,
    organization_id: "org-1",
    source: "memory_events",
    specialist: "sales",
    category: "industry",
    finding,
    confidence: 0.9,
    supporting_event_count: 4,
    first_observed_at: now,
    last_confirmed_at: now,
    superseded_by: null,
    active: true,
    metadata: {},
  }
}

function emptyWorkManager(overrides: Record<string, unknown> = {}) {
  return {
    qaMarker: GROWTH_WORK_MANAGER_QA_MARKER,
    active_work: null,
    work_plan: [],
    operator_queue: [],
    blocked: [],
    completed_today: [],
    deferred: [],
    interruptions: [],
    all_work_items: [],
    ...overrides,
  }
}

function emptyRhythm() {
  return {
    qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
    current_phase: "research_cycle" as const,
    completed_phases: [],
    next_phase: null,
    active_cycle: null,
    today_plan: [],
    phase_timeline: [],
    interruptions: [],
    waiting_on_operator: [],
    end_of_day_summary: null,
  }
}

function main(): void {
  console.log(`[${PHASE}] Narrative Intelligence certification`)

  assert.equal(GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER, "ge-aios-18f-narrative-intelligence-v1")
  console.log("  ✓ 18F QA marker")

  const greeting = buildPersonalizedHomeGreeting({
    hour: 9,
    operatorDisplayName: "Mike Johnson",
  })
  assert.equal(greeting, "Good morning, Mike.")
  console.log("  ✓ personalized greeting")

  const completed = buildDailyActivityCompletedLines({
    memorySummary: null,
    salesDailySummary: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      generatedAt: new Date().toISOString(),
      researched: 23,
      qualified: 6,
      strong_opportunities: 3,
      outreach_prepared: 2,
      meetings_prepared: 0,
      approvals_pending: 0,
    },
    repliesToday: 4,
  })
  assert.match(completed[0] ?? "", /researched 23 companies/i)
  assert.match(completed[1] ?? "", /qualified 6/i)
  assert.ok(completed.some((line) => /prepared 2 outreach drafts/i.test(line)))
  assert.ok(completed.some((line) => /reviewed 4 replies/i.test(line)))
  console.log("  ✓ runtime-driven accomplishments")

  const workResult = emptyWorkManager({
    active_work: {
      id: "work-1",
      type: "research",
      title: "Research company — Regional Hospital",
      description: null,
      status: "working",
      priority: 1,
      source: "decision_engine",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      estimated_minutes: null,
      estimated_revenue_impact: null,
      requires_operator: false,
      can_execute_autonomously: true,
      depends_on: [],
      blocked_by: [],
      next_action: null,
      decision_score: 0.9,
      confidence: 0.9,
      href: null,
      company_name: "Regional Hospital",
      decision_source_id: "decision-1",
    },
    work_plan: [
      {
        work_item_id: "work-2",
        title: "Prepare outreach — Acme Medical",
        status: "ready",
        position: 1,
      },
    ],
    all_work_items: [
      {
        id: "work-2",
        type: "outreach",
        title: "Prepare outreach — Acme Medical",
        description: null,
        status: "ready",
        priority: 1,
        source: "decision_engine",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        estimated_minutes: null,
        estimated_revenue_impact: null,
        requires_operator: false,
        can_execute_autonomously: true,
        depends_on: [],
        blocked_by: [],
        next_action: null,
        decision_score: 0.8,
        confidence: 0.8,
        href: null,
        company_name: "Acme Medical",
        decision_source_id: "decision-2",
      },
    ],
  })

  const workingNow = buildDailyActivityWorkingNowLines({
    workResult,
    operatingRhythm: emptyRhythm(),
    specialistOrchestrator: null,
  })
  assert.match(workingNow[0] ?? "", /researching Regional Hospital/i)
  console.log("  ✓ runtime-driven current work")

  const approvalNarrative = buildAvaDailyActivityNarrative({
    pendingApprovalCount: 2,
    memorySummary: {
      qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
      recent_events: [],
      important_events: [],
      preferences: [],
      detected_patterns: [],
      corrections: [],
      unanswered_questions: [],
      timeline: [],
      learned_insights: [],
      period_summary: null,
      organizational_knowledge: [],
    },
    workResult: emptyWorkManager({
      operator_queue: [
        {
          id: "approval-1",
          type: "approval",
          title: "Approve outreach",
          description: null,
          status: "blocked",
          priority: 1,
          source: "operator_queue",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          estimated_minutes: null,
          estimated_revenue_impact: null,
          requires_operator: true,
          can_execute_autonomously: false,
          depends_on: [],
          blocked_by: [],
          next_action: null,
          decision_score: 0.9,
          confidence: 0.9,
          href: null,
          company_name: "Acme",
          decision_source_id: "decision-approval",
        },
        {
          id: "approval-2",
          type: "approval",
          title: "Approve outreach",
          description: null,
          status: "blocked",
          priority: 1,
          source: "operator_queue",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          estimated_minutes: null,
          estimated_revenue_impact: null,
          requires_operator: true,
          can_execute_autonomously: false,
          depends_on: [],
          blocked_by: [],
          next_action: null,
          decision_score: 0.9,
          confidence: 0.9,
          href: null,
          company_name: "Beta",
          decision_source_id: "decision-approval-2",
        },
      ],
    }),
    operatingRhythm: emptyRhythm(),
    hour: 10,
  })
  assert.equal(approvalNarrative.focus, "approvals")
  assert.equal(approvalNarrative.section_order[0], "waiting_on_you")
  assert.ok(approvalNarrative.waiting_on_you.some((line) => /2 opportunity packages ready for your review/i.test(line)))
  console.log("  ✓ runtime-driven approvals with context-aware ordering")

  const knowledgeNarrative = buildAvaDailyActivityNarrative({
    memorySummary: {
      qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
      recent_events: [],
      important_events: [],
      preferences: [],
      detected_patterns: [],
      corrections: [],
      unanswered_questions: [],
      timeline: [],
      learned_insights: [],
      period_summary: null,
      organizational_knowledge: [
        knowledgeItem("Medical equipment companies continue responding best."),
      ],
    },
    workResult: emptyWorkManager(),
    operatingRhythm: emptyRhythm(),
    hour: 10,
  })
  assert.ok(knowledgeNarrative.learned_today.some((line) => /medical equipment companies/i.test(line)))
  console.log("  ✓ knowledge-driven learning")

  const emptyKnowledge = buildAvaDailyActivityNarrative({
    memorySummary: null,
    workResult: emptyWorkManager(),
    operatingRhythm: emptyRhythm(),
    hour: 10,
  })
  assert.ok(
    emptyKnowledge.learned_today.some((line) => line.includes(NARRATIVE_INTELLIGENCE_EMPTY_LEARNED_MESSAGE)),
  )
  console.log("  ✓ graceful learning degradation")

  const nextLines = buildDailyActivityWorkingNextLines({
    workResult,
    operatingRhythm: emptyRhythm(),
    hour: 10,
  })
  assert.ok(nextLines.some((line) => /Next I'll/i.test(line)))
  console.log("  ✓ runtime-driven next steps")

  const order = resolveNarrativeIntelligenceSectionOrder({
    completedCount: 1,
    workingNowCount: 1,
    waitingCount: 2,
    learnedCount: 0,
    workingNextCount: 1,
    approvalCount: 5,
    replyCount: 0,
    focus: "approvals",
  })
  assert.equal(order[0], "waiting_on_you")
  console.log("  ✓ approvals top billing over research activity")

  const narrativeEngine = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative.ts")
  const briefingEngine = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  const heroSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")

  assert.match(narrativeEngine, /buildAvaDailyActivityNarrative/)
  assert.match(narrativeEngine, /resolveNarrativeIntelligenceSectionOrder/)
  assert.match(briefingEngine, /buildAvaDailyActivityNarrative\(/)
  assert.doesNotMatch(heroSection, /buildAvaDailyActivityNarrative/)
  assert.match(heroSection, /section_order/)
  assert.match(heroSection, /data-qa-marker-18f/)
  assert.doesNotMatch(hook, /Promise\.all\(\[.*workspace-summary/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  console.log("  ✓ single narrative engine; single workspace-summary")

  const briefing = buildAvaDailyBriefing({
    greeting: "Good morning",
    hour: 9,
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 3,
        callsToday: 0,
        openOpportunities: 0,
        hotCompanies: 0,
        approvalQueueCount: 0,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
      avaConsole: { researchLoopSummary: null } as never,
      dashboard: { sections: [] } as never,
      leadPool: null,
    },
    accomplishments: [],
    waitingOnYou: [],
    dailyWorkQueue: [],
    timeline: [],
    salesOutcomes: {
      qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
      outcomes: [],
      dailySummary: {
        qaMarker: GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER,
        generatedAt: new Date().toISOString(),
        researched: 5,
        qualified: 0,
        strong_opportunities: 0,
        outreach_prepared: 0,
        meetings_prepared: 0,
        approvals_pending: 0,
      },
    },
  })
  assert.equal(briefing.daily_activity_narrative?.qaMarker, GROWTH_AVA_DAILY_ACTIVITY_NARRATIVE_QA_MARKER)
  assert.ok((briefing.daily_activity_narrative?.completed_today.length ?? 0) > 0)
  assert.ok(!/dashboard|widget|module|system status/i.test(briefing.daily_activity_narrative?.summary ?? ""))
  console.log("  ✓ briefing composed from canonical runtime without fabricated dashboard copy")

  const hero = buildAvaHomeHero({
    greeting: "Good morning",
    hour: 9,
    employeeStatus: { kind: "researching", label: "Researching companies" },
    aiOsUx: {
      qaMarker: GROWTH_HOME_AI_OS_UX_QA_MARKER,
      hero: {} as never,
      waitingOnYou: [],
      waitingOnYouOverflow: 0,
      approveItemsCount: 0,
      approveItemsHref: null,
      liveStatus: null,
      dailyWorkQueueBuckets: null,
      dailyWorkQueue: [],
      throughput: [],
      mailboxDomainHealth: null,
      autonomousReadiness: null,
    },
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
    operatorDisplayName: "Mike Johnson",
    workspaceSummary: {
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
      avaConsole: { researchLoopSummary: null } as never,
      dashboard: { sections: [] } as never,
      leadPool: null,
    },
  })
  assert.match(hero.greeting, /Mike/)
  const opening = buildNarrativeIntelligenceOpeningLine({
    focus: hero.dailyActivityNarrative?.focus ?? "idle",
    completedCount: hero.dailyActivityNarrative?.completed_today.length,
  })
  assert.ok(opening.length > 0)
  console.log("  ✓ hero consumes intelligence narrative")

  console.log(`\n[${PHASE}] PASS — Narrative Intelligence certified`)
}

main()
