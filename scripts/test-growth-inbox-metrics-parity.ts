/**
 * Growth inbox metrics + workspace/admin parity audit (Phase 7I — local only).
 *
 * Usage: pnpm test:growth-inbox-metrics-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER,
  countUnreadInboxConversations,
  deriveGrowthInboxOverviewMetrics,
} from "../lib/growth/inbox/growth-inbox-overview-metrics"
import {
  GROWTH_INBOX_WORKSPACE_PARITY_MATRIX,
  GROWTH_INBOX_WORKSPACE_PARITY_QA_MARKER,
  listGrowthInboxParityGaps,
} from "../lib/growth/inbox/growth-inbox-workspace-parity"
import { countInboxThreadsByQueueView } from "../lib/growth/inbox/inbox-thread-queue-filters"
import type { GrowthInboxThread } from "../lib/growth/inbox/inbox-types"
import { GROWTH_REPLY_INTELLIGENCE_DASHBOARD_CLIENT_QA_MARKER } from "../lib/growth/replies/growth-reply-intelligence-dashboard-client"
import { AIDEN_OPERATOR_GUIDE_QA_MARKER } from "../lib/growth/aiden/operator-guide"
import type { GrowthSalesExecutionDashboard } from "../lib/growth/reply-intelligence/reply-intent-types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleThread(overrides: Partial<GrowthInboxThread>): GrowthInboxThread {
  return {
    id: "thread-1",
    lead_id: "00000000-0000-4000-8000-000000000001",
    lead_label: "Acme",
    channel: "email",
    provider_family: "manual",
    mailbox_connection_id: null,
    subject: "Pricing follow-up",
    thread_status: "open",
    reply_count: 1,
    last_message_at: new Date().toISOString(),
    owner_user_id: null,
    owner_label: null,
    priority_score: 80,
    priority_tier: "high",
    classification: "positive_interest",
    classification_confidence: 0.9,
    requires_human_review: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function sampleDashboard(): GrowthSalesExecutionDashboard {
  return {
    qaMarker: "reply-intelligence-v1",
    v2QaMarker: "growth-reply-intelligence-v1",
    totalReplies: 10,
    highPriorityCount: 2,
    criticalCount: 1,
    meetingRequestCount: 3,
    competitorMentionCount: 0,
    unansweredCount: 4,
    ownerWaitingCount: 1,
    overdueCount: 0,
    averageResponseLatencyMs: 1000,
    replyTrend: [],
    needsReviewCount: 5,
    interestedCount: 6,
    demoRequestCount: 2,
    pricingQuestionCount: 1,
    objectionHeavyCount: 2,
    stopUnsubscribeCount: 0,
    angryComplaintCount: 0,
    lowConfidenceCount: 1,
    workflowTaskCount: 7,
    campaignLearning: {
      positiveReplyRate: 0.1,
      objectionRate: 0.05,
      unsubscribeReplyRate: 0,
      demoRequestRate: 0.02,
      pricingQuestionRate: 0.01,
    },
  }
}

function runAudit(): void {
  console.log(`\n=== Growth inbox metrics parity audit (${GROWTH_INBOX_WORKSPACE_PARITY_QA_MARKER}) ===\n`)

  const threads = [
    sampleThread({ id: "t1", thread_status: "needs_review", requires_human_review: true }),
    sampleThread({
      id: "t2",
      classification: "meeting_request",
      thread_status: "open",
      requires_human_review: false,
    }),
    sampleThread({
      id: "t3",
      classification: "budget",
      priority_tier: "critical",
      thread_status: "open",
      requires_human_review: true,
    }),
    sampleThread({ id: "t4", thread_status: "archived", requires_human_review: true }),
  ]

  const queueCounts = countInboxThreadsByQueueView(threads)
  assert.ok(queueCounts.needs_action >= 2)
  assert.equal(countUnreadInboxConversations(threads), 2)
  console.log("  ✓ thread queue + unread derivation")

  const dashboard = sampleDashboard()
  const metrics = deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard })
  assert.equal(metrics.qaMarker, GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER)
  assert.equal(metrics.workflowTasks, dashboard.workflowTaskCount)
  assert.equal(metrics.needsReview, dashboard.needsReviewCount)
  assert.equal(metrics.meetingRequests, dashboard.meetingRequestCount)
  assert.equal(metrics.needsAction, queueCounts.needs_action)
  console.log("  ✓ overview metrics merge thread counts with reply dashboard")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxOverviewMetricsPanel/)
  console.log("  ✓ v2 panel mounts overview metrics")

  const replyPanel = readSource("components/growth/inbox/growth-inbox-reply-intelligence-panel.tsx")
  assert.match(replyPanel, /useGrowthReplyIntelligenceDashboard/)
  assert.match(replyPanel, /Meeting requests/)
  assert.match(replyPanel, /growth-inbox-reply-intelligence-panel-v2/)
  console.log("  ✓ reply intelligence panel uses shared dashboard hook + meeting requests stat")

  const dashboardClient = readSource("lib/growth/replies/growth-reply-intelligence-dashboard-client.ts")
  assert.match(dashboardClient, new RegExp(GROWTH_REPLY_INTELLIGENCE_DASHBOARD_CLIENT_QA_MARKER))
  assert.match(dashboardClient, /\/api\/platform\/growth\/replies\/dashboard/)
  console.log("  ✓ shared reply dashboard client targets existing API")

  const parityAvailable = GROWTH_INBOX_WORKSPACE_PARITY_MATRIX.filter((row) => row.status === "available")
  assert.ok(parityAvailable.length >= 6)
  const gaps = listGrowthInboxParityGaps()
  assert.ok(gaps.some((row) => row.id === "sales-execution-filters"))
  assert.ok(gaps.some((row) => row.id === "admin-reply-inbox-surface"))
  console.log("  ✓ parity matrix documents available surfaces and deferred gaps")

  const operatorGuide = readSource("lib/growth/aiden/operator-guide.ts")
  assert.match(operatorGuide, new RegExp(AIDEN_OPERATOR_GUIDE_QA_MARKER))
  assert.match(operatorGuide, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.replyWorkflow/)
  assert.match(operatorGuide, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.inbox/)
  assert.doesNotMatch(operatorGuide, /\/admin\/growth\/replies\/workflow/)
  console.log("  ✓ operator guide workflow links use workspace canonical path")

  const aggregator = readSource("lib/growth/operator-inbox/operator-inbox-aggregator.ts")
  assert.match(aggregator, /GROWTH_WORKSPACE_BASE_PATH\}\/inbox\/workflow/)
  assert.match(aggregator, /GROWTH_WORKSPACE_BASE_PATH\}\/inbox\?threadId=/)
  assert.doesNotMatch(aggregator, /\/admin\/growth\/inbox\?threadId=/)
  assert.doesNotMatch(aggregator, /\/admin\/growth\/command\?leadId=/)
  console.log("  ✓ operator inbox CTAs use workspace inbox paths")

  console.log("\n=== Growth inbox metrics parity audit passed ===\n")
}

runAudit()
