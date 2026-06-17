import assert from "node:assert/strict"
import { orchestrateGrowthInboxRecommendations } from "../lib/growth/inbox/inbox-recommendation-orchestrator"
import {
  filterInboxThreadsByQueueView,
  GROWTH_INBOX_QUEUE_VIEWS,
} from "../lib/growth/inbox/inbox-thread-queue-filters"
import type { GrowthInboxThread } from "../lib/growth/inbox/inbox-types"

function sampleThread(overrides: Partial<GrowthInboxThread>): GrowthInboxThread {
  return {
    id: "thread-1",
    lead_id: "00000000-0000-4000-8000-000000000001",
    lead_label: "Acme",
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

function main() {
  assert.equal(GROWTH_INBOX_QUEUE_VIEWS.length, 9)

  const threads = [
    sampleThread({ id: "a", requires_human_review: true, priority_tier: "normal" }),
    sampleThread({
      id: "b",
      owner_user_id: "user-1",
      requires_human_review: false,
      classification: "question",
      priority_tier: "normal",
    }),
    sampleThread({
      id: "c",
      classification: "meeting_intent",
      requires_human_review: false,
      priority_tier: "normal",
    }),
    sampleThread({
      id: "e",
      classification: "budget",
      requires_human_review: false,
      priority_tier: "normal",
    }),
    sampleThread({
      id: "f",
      classification: "question",
      priority_tier: "critical",
      requires_human_review: false,
    }),
    sampleThread({ id: "d", thread_status: "archived" }),
  ]

  assert.equal(filterInboxThreadsByQueueView(threads, "needs_action").length, 2)
  assert.equal(filterInboxThreadsByQueueView(threads, "unassigned").length, 4)
  assert.equal(filterInboxThreadsByQueueView(threads, "interested").length, 1)
  assert.equal(filterInboxThreadsByQueueView(threads, "meeting_intent").length, 1)
  assert.equal(filterInboxThreadsByQueueView(threads, "objections").length, 1)
  assert.equal(filterInboxThreadsByQueueView(threads, "high_priority").length, 1)
  assert.equal(filterInboxThreadsByQueueView(threads, "archived").length, 1)

  const { top } = orchestrateGrowthInboxRecommendations({
    workflowActions: [
      {
        id: "wf-1",
        leadId: "00000000-0000-4000-8000-000000000001",
        replyId: null,
        actionType: "create_call_task",
        actionStatus: "pending_review",
        severity: "high",
        title: "Schedule discovery call",
        summary: "Prospect asked for pricing.",
        createdAt: new Date().toISOString(),
        companyName: "Acme",
        replyIntent: "pricing_question",
        replyNextAction: "call_prospect",
        replyBodyPreview: "Can you share pricing?",
        replyReceivedAt: new Date().toISOString(),
        category: "call_task",
      },
    ],
    opportunityRecommendations: [],
    bookingRecommendations: [],
    copilot: null,
    lead: null,
    revenueReadiness: null,
    forecastEvidence: null,
    executionPlan: null,
    playbook: null,
    commandCenterLead: null,
  })

  assert.equal(top?.source, "workflow_action")
  assert.match(top?.recommendedNextStep ?? "", /call/i)

  console.log("growth-inbox-workspace-phase3: all checks passed")
}

main()
