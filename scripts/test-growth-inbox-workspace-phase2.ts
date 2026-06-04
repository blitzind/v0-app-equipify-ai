import assert from "node:assert/strict"
import { orchestrateGrowthInboxRecommendations } from "../lib/growth/inbox/inbox-recommendation-orchestrator"

const emptyRevenue = {
  revenueReadiness: null,
  forecastEvidence: null,
  executionPlan: null,
  playbook: null,
  commandCenterLead: null,
}

function main() {
  const workflow = orchestrateGrowthInboxRecommendations({
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
    ...emptyRevenue,
  }).top

  assert.equal(workflow?.source, "workflow_action")
  assert.match(workflow?.recommendation ?? "", /discovery call/)

  const copilotFallback = orchestrateGrowthInboxRecommendations({
    workflowActions: [],
    opportunityRecommendations: [],
    bookingRecommendations: [],
    copilot: {
      qaMarker: "growth-reply-intelligence-v1",
      assistedLabel: "AI-assisted",
      summary: "Prospect is evaluating options.",
      intent: "positive_interest",
      objections: [],
      suggestedNextStep: "Offer a short discovery call.",
      suggestedReplyDraft: "Happy to walk through pricing.",
      suggestedInternalNote: "Follow up within 24h.",
      callPrepBullets: [],
      confidenceTier: "high",
      uncertaintyState: "confident",
      evidenceExcerpts: ["Interested in demo"],
    },
    lead: null,
    ...emptyRevenue,
  }).top

  assert.equal(copilotFallback?.source, "reply_copilot")
  assert.match(copilotFallback?.recommendation ?? "", /discovery call/)

  console.log("growth-inbox-workspace-phase2: all checks passed")
}

main()
