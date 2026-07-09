/**
 * GE-AIOS-15D — Relationship Stage & Conversation Binding certification.
 * Run: pnpm test:ge-aios-15d-relationship-stage-conversation-binding
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import { orchestrateWorkManagerResult } from "../lib/growth/specialists/engine/run-specialist-orchestrator"
import {
  GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER,
  GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
  attachRelationshipGraphToCandidate,
  buildRelationshipGraphContext,
  buildRelationshipLeadSnapshotsFromResearchLoop,
  enrichRelationshipGraphWithSnapshot,
  hasRelationshipGraphBinding,
} from "../lib/growth/relationship"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { buildGrowthHomeLeadPoolSummary } from "../lib/growth/home/growth-home-lead-pool-pagination"

const PHASE = "GE-AIOS-15D" as const

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

const leadId = "11111111-1111-4111-8111-111111111111"
const threadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const researchSummary: GrowthAvaResearchLoopSummary = {
  qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
  runId: "run-15d",
  completedAt: new Date().toISOString(),
  companiesReviewed: 2,
  researchCompleted: 2,
  buyingSignalsVerified: 1,
  readyForOutreachReview: 1,
  qualificationCompleted: 1,
  qualificationSkipped: 0,
  qualificationFailed: 0,
  narrative: "Ava reviewed 2 companies.",
  leadResults: [
    {
      leadId,
      companyName: "Precision Biomedical",
      outcome: "completed",
      readyForOutreachReview: true,
      hasBuyingSignals: true,
      qualificationStatus: "completed",
    },
    {
      leadId: "22222222-2222-4222-8222-222222222222",
      companyName: "ABC Medical",
      outcome: "completed",
      readyForOutreachReview: false,
      hasBuyingSignals: false,
      qualificationStatus: "completed",
    },
  ],
  transportBlocked: true,
  humanApprovalRequired: true,
  outboundOccurred: false,
}

function workspaceSummaryFixture() {
  return {
    kpis: { emailsSentToday: 0, repliesToday: 1, callsToday: 0, openOpportunities: 2, hotCompanies: 1, approvalQueueCount: 1 },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 1, threadsOpen: 1, newReplies: 1 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 1, leadsNeedingAction: 2 },
    avaConsole: {
      greeting: "Good morning.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Review outreach",
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
    leadPool: buildGrowthHomeLeadPoolSummary({
      visibleLeads: [{ id: "11111111-1111-4111-8111-111111111111", createdAt: new Date().toISOString() }],
      totalEstimatedCount: 1,
      relationshipSnapshotCount: 0,
      fetchedHasMore: false,
    }),
  }
}

function main(): void {
  console.log(`[${PHASE}] Relationship Stage & Conversation Binding certification`)

  assert.equal(GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER, "ge-aios-15d-relationship-stage-conversation-v1")

  const graphTypes = readSource("lib/growth/relationship/relationship-graph-types.ts")
  assert.match(graphTypes, /relationship_health/)
  assert.match(graphTypes, /latest_conversation_thread_id/)
  assert.match(graphTypes, /conversation_timeline_summary/)
  assert.match(graphTypes, /waiting_on_operator/)

  const stateResolver = readSource("lib/growth/relationship/resolve-relationship-state-context.ts")
  assert.match(stateResolver, /lead_memory_profiles/)
  assert.match(stateResolver, /relationship_context/)
  assert.doesNotMatch(stateResolver, /computeGrowthLeadRelationshipStrength|runDecisionEngine/)

  const conversationResolver = readSource("lib/growth/relationship/resolve-relationship-conversation-context.ts")
  assert.match(conversationResolver, /inbox_threads/)
  assert.match(conversationResolver, /conversation_timeline_events/)
  assert.match(conversationResolver, /\.limit\(1\)/)
  assert.match(conversationResolver, /\.limit\(5\)/)
  assert.doesNotMatch(conversationResolver, /insert\(/)

  const decisionContext = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
  assert.match(decisionContext, /leadSnapshotsById/)

  const salesSpecialist = readSource("lib/growth/specialists/specialists/sales-specialist.ts")
  assert.match(salesSpecialist, /buildSalesSpecialistRelationshipSuffix/)
  assert.match(salesSpecialist, /no conversation yet/)

  const narrative = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
  assert.match(narrative, /buildRelationshipContextClause/)

  const snapshots = buildRelationshipLeadSnapshotsFromResearchLoop(researchSummary)
  assert.equal(snapshots[leadId]?.relationship_stage, "evaluating")
  assert.equal(snapshots[leadId]?.waiting_on_operator, true)

  const withConversation = enrichRelationshipGraphWithSnapshot(
    buildRelationshipGraphContext({ lead_id: leadId, relationship_stage: "evaluating" }),
    {
      qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
      lead_id: leadId,
      latest_conversation_thread_id: threadId,
      latest_reply_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      latest_reply_sentiment: "positive_interest",
      conversation_timeline_summary: "Customer asked about pricing.",
      waiting_on_customer: true,
      conversation_context_available: true,
    },
  )
  assert.equal(withConversation.latest_conversation_thread_id, threadId)
  assert.equal(withConversation.relationship_state_qa_marker, GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER)
  assert.ok(hasRelationshipGraphBinding(withConversation))

  const withoutConversation = attachRelationshipGraphToCandidate(
    {
      id: `research:${leadId}`,
      kind: "research_company",
      title: "Research company — No History Co",
      detail: null,
      href: `/growth/leads/${leadId}`,
      companyName: "No History Co",
      source: "research_loop",
    },
    { snapshot: snapshots[leadId] },
  )
  assert.equal(withoutConversation.relationship_graph?.relationship_stage, "evaluating")
  assert.equal(withoutConversation.relationship_graph?.latest_conversation_thread_id, null)

  const decisionInput = {
    workspaceSummary: workspaceSummaryFixture(),
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    leadSnapshotsById: snapshots,
  }

  const decisionResult = runDecisionEngine(decisionInput)
  const researchAction = decisionResult.next_best_actions.find((row) => row.source_id === `research:${leadId}`)
  assert.ok(researchAction?.relationship_graph?.relationship_stage)
  assert.equal(researchAction?.relationship_graph?.waiting_on_operator, true)

  const workResult = runWorkManager(decisionInput)
  const workItem = workResult.all_work_items.find((row) => row.decision_source_id === `research:${leadId}`)
  assert.ok(workItem?.relationship_graph?.relationship_stage)

  const { specialistResult } = orchestrateWorkManagerResult(workResult)
  const salesItems = specialistResult.routed_work_items.filter((row) => row.assigned_specialist === "sales")
  assert.ok(salesItems.some((row) => row.relationship_graph?.relationship_stage))

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const newMigrations = fs.readdirSync(migrationDir).filter((name) => name.includes("15d"))
  assert.equal(newMigrations.length, 0, "15D must not add schema migrations")

  assert.doesNotMatch(readSource("lib/growth/relationship/index.ts"), /resolveRelationshipLeadSnapshot/)

  console.log(`[${PHASE}] PASS — Relationship Stage & Conversation Binding certified (local)`)
}

main()
