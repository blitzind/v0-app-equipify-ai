/**
 * GE-AIOS-15E — Server-side relationship snapshot enrichment certification.
 * Run: pnpm test:ge-aios-15e-server-relationship-snapshots
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { runDecisionEngine } from "../lib/growth/decision-engine/engine/run-decision-engine"
import { runWorkManager } from "../lib/growth/work-manager/manager/run-work-manager"
import {
  GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
} from "../lib/growth/home/growth-home-workspace-summary-types"
import { buildGrowthHomeLeadPoolSummary } from "../lib/growth/home/growth-home-lead-pool-pagination"
import { GROWTH_HOME_LEAD_POOL_BATCH_LIMIT } from "../lib/growth/relationship/relationship-scale-limits"
import {
  enrichRelationshipGraphWithSnapshot,
  mergeRelationshipLeadSnapshotMaps,
} from "../lib/growth/relationship/project-relationship-graph-enrichment"
import {
  buildRelationshipGraphContext,
  GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER,
} from "../lib/growth/relationship/relationship-graph-types"
import { GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER } from "../lib/growth/relationship/relationship-lead-snapshot-types"
import { buildAvaHomeHero } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

const PHASE = "GE-AIOS-15E" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function certLeadPoolFixture() {
  return buildGrowthHomeLeadPoolSummary({
    visibleLeads: [{ id: "11111111-1111-4111-8111-111111111111", createdAt: new Date().toISOString() }],
    totalEstimatedCount: 1,
    relationshipSnapshotCount: 1,
    fetchedHasMore: false,
  })
}

function main(): void {
  console.log(`[${PHASE}] Server Relationship Snapshot Enrichment certification`)

  assert.equal(GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER, "ge-aios-15e-server-relationship-snapshots-v1")

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /enrichRelationshipLeadSnapshotsBatch/)
  assert.match(summaryService, /relationshipSnapshots/)
  assert.doesNotMatch(summaryService, /for \(const lead of leads\)[\s\S]*resolveRelationshipLeadSnapshot/)

  const batchModule = readSource("lib/growth/relationship/enrich-relationship-lead-snapshots-batch.ts")
  assert.match(batchModule, /\.in\("lead_id", leadIds\)/)
  assert.match(batchModule, /queryCount = 5/)
  assert.match(batchModule, /degraded: true/)
  assert.doesNotMatch(batchModule, /resolveRelationshipLeadSnapshot\(/)
  assert.match(batchModule, /GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT/)

  const summaryTypes = readSource("lib/growth/home/growth-home-workspace-summary-types.ts")
  assert.match(summaryTypes, /relationshipSnapshots: GrowthHomeRelationshipSnapshotEnrichment/)

  const hook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, "/api/platform/growth/home/workspace-summary")
  assert.doesNotMatch(hook, /relationshipSnapshots.*fetch/)

  const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(hero, /mergeRelationshipLeadSnapshotMaps/)
  assert.match(hero, /relationshipSnapshots\?\.byLeadId/)

  const dashboard = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
  assert.match(dashboard, /relationshipSnapshots/)

  const leadId = "11111111-1111-4111-8111-111111111111"
  const serverSnapshot = {
    qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
    lead_id: leadId,
    relationship_stage: "engaged" as const,
    latest_conversation_thread_id: "thread-1",
    latest_reply_at: new Date().toISOString(),
    conversation_timeline_summary: "Customer asked about pricing.",
    next_best_action: "review_reply",
    conversation_context_available: true,
  }

  const mergedSnapshots = mergeRelationshipLeadSnapshotMaps(
    {
      [leadId]: {
        qa_marker: GROWTH_RELATIONSHIP_LEAD_SNAPSHOT_QA_MARKER,
        lead_id: leadId,
        relationship_stage: "evaluating",
        waiting_on_operator: true,
      },
    },
    { [leadId]: serverSnapshot },
  )
  assert.equal(mergedSnapshots[leadId]?.relationship_stage, "engaged")
  assert.equal(mergedSnapshots[leadId]?.latest_conversation_thread_id, "thread-1")

  const graph = enrichRelationshipGraphWithSnapshot(
    buildRelationshipGraphContext({ lead_id: leadId }),
    serverSnapshot,
  )
  assert.equal(graph.relationship_state_qa_marker, GROWTH_RELATIONSHIP_GRAPH_15D_QA_MARKER)

  const decisionResult = runDecisionEngine({
    workspaceSummary: {
      kpis: {
        emailsSentToday: 0,
        repliesToday: 1,
        callsToday: 0,
        openOpportunities: 1,
        hotCompanies: 1,
        approvalQueueCount: 0,
      },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      inbox: { repliesNeedingAttention: 1, threadsOpen: 1, newReplies: 1 },
      operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 1 },
      avaConsole: {
        greeting: "Hi",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { generatedAt: new Date().toISOString(), briefing: null, sections: [] },
      leadPool: certLeadPoolFixture(),
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    leadSnapshotsById: mergedSnapshots,
  })

  const action = decisionResult.next_best_actions.find((row) => row.relationship_graph?.lead_id === leadId)
  if (action) {
    assert.equal(action.relationship_graph?.latest_conversation_thread_id, "thread-1")
  }

  const workResult = runWorkManager({
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
      avaConsole: {
        greeting: "Hi",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: {
          qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
          runId: "run",
          completedAt: new Date().toISOString(),
          companiesReviewed: 1,
          researchCompleted: 1,
          buyingSignalsVerified: 0,
          readyForOutreachReview: 1,
          qualificationCompleted: 0,
          qualificationSkipped: 0,
          qualificationFailed: 0,
          narrative: "Research complete.",
          leadResults: [
            {
              leadId,
              companyName: "Precision Biomedical",
              outcome: "completed",
              readyForOutreachReview: true,
              hasBuyingSignals: false,
              qualificationStatus: "completed",
            },
          ],
          transportBlocked: true,
          humanApprovalRequired: true,
          outboundOccurred: false,
        },
      },
      dashboard: { generatedAt: new Date().toISOString(), briefing: null, sections: [] },
      leadPool: certLeadPoolFixture(),
      relationshipSnapshots: {
        qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
        byLeadId: mergedSnapshots,
        meta: { attempted: 1, enriched: 1, degraded: false, warning: null, queryCount: 5 },
      },
    },
    waitingOnYou: [],
    dailyWorkQueue: [],
    accomplishments: [],
    timeline: [],
    leadSnapshotsById: mergedSnapshots,
  })

  assert.ok(workResult.all_work_items.some((row) => row.relationship_graph?.latest_reply_at))

  const heroView = buildAvaHomeHero({
    greeting: "Good morning, Mike.",
    hour: 9,
    employeeStatus: { kind: "working", label: "Working", activityLabel: "working" },
    aiOsUx: {
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
    },
    researchLoopSummary: null,
    accomplishments: [],
    repliesWaiting: 0,
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
      avaConsole: {
        greeting: "Hi",
        overnightSummary: null,
        highPriorityOpportunities: null,
        waitingForApproval: null,
        suggestedNextAction: null,
        researchLoopSummary: null,
      },
      dashboard: { generatedAt: new Date().toISOString(), briefing: null, sections: [] },
      leadPool: certLeadPoolFixture(),
      relationshipSnapshots: {
        qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
        byLeadId: mergedSnapshots,
        meta: { attempted: 1, enriched: 1, degraded: false, warning: null, queryCount: 5 },
      },
    },
  })

  assert.ok(heroView.workManager)

  const migrationDir = path.join(process.cwd(), "supabase/migrations")
  const newMigrations = fs.readdirSync(migrationDir).filter((name) => name.includes("15e"))
  assert.equal(newMigrations.length, 0, "15E must not add schema migrations")

  const engineSource = readSource("lib/growth/decision-engine/engine/run-decision-engine.ts")
  assert.doesNotMatch(engineSource, /executeReadyWorkItems|sendEmail|outbound/)

  assert.ok(GROWTH_HOME_LEAD_POOL_BATCH_LIMIT <= 250)

  console.log(`[${PHASE}] PASS — Server Relationship Snapshot Enrichment certified (local)`)
}

main()
