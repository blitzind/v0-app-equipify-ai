/**
 * Regression checks for AI Reply Drafting + Human Review (Phase 2J).
 * Run: pnpm test:growth-ai-reply-drafting
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildReplyDraftSystemPrompt, buildReplyDraftUserPrompt, fallbackReplyDraft } from "../lib/growth/replies/reply-prompt"
import { assertReplyDraftApproved, evaluateReplyRiskGuard } from "../lib/growth/replies/reply-risk-guard"
import {
  GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE,
  GROWTH_AI_REPLY_DRAFTING_QA_MARKER,
  GROWTH_REPLY_DRAFT_AI_TASK,
  GROWTH_REPLY_DRAFT_STATUSES,
  GROWTH_REPLY_DRAFT_TIMELINE_EVENT_TYPES,
  GROWTH_REPLY_DRAFT_TYPES,
  maskReplyDraftLeadLabel,
  replyDraftStatusLabel,
  resolveReplyDraftTypeFromClassification,
} from "../lib/growth/replies/reply-draft-types"
import { GROWTH_AI_REPLY_DRAFTING_SCHEMA_MIGRATION } from "../lib/growth/replies/reply-draft-schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_AI_REPLY_DRAFTING_QA_MARKER, "growth-ai-reply-drafting-v1")
  assert.match(GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE, /human approval/i)
  assert.match(GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE, /no autonomous replies/i)
  assert.equal(GROWTH_REPLY_DRAFT_STATUSES.length, 5)
  assert.equal(GROWTH_REPLY_DRAFT_TIMELINE_EVENT_TYPES.length, 5)
  assert.equal(GROWTH_REPLY_DRAFT_TYPES.length, 7)
  assert.equal(GROWTH_REPLY_DRAFT_AI_TASK, "growth_reply_draft_generation")

  const migration = readSource(`supabase/migrations/${GROWTH_AI_REPLY_DRAFTING_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.inbox_reply_drafts/)
  assert.match(migration, /growth\.inbox_reply_draft_events/)
  assert.match(migration, /reply_draft_generated/)
  assert.match(migration, /reply_draft_approved/)
  assert.match(migration, /reply_draft_discarded/)
  assert.match(migration, /reply_draft_sent/)
  assert.match(migration, /reply_draft_blocked/)
  assert.match(migration, /idx_growth_inbox_reply_drafts_thread/)
  assert.match(migration, /service role only/)

  assert.equal(replyDraftStatusLabel("pending_approval" as never), "pending approval")
  assert.equal(maskReplyDraftLeadLabel("abc12345-0000-0000-0000-000000000001", "Acme Corp"), "Acme Corp")
  assert.match(maskReplyDraftLeadLabel("abc12345-0000-0000-0000-000000000001"), /^Lead abc12345/)
  assert.equal(resolveReplyDraftTypeFromClassification("positive_interest"), "positive_interest_reply")
  assert.equal(resolveReplyDraftTypeFromClassification("meeting_intent"), "meeting_booking_reply")
  assert.equal(resolveReplyDraftTypeFromClassification("unsubscribe"), "not_interested_acknowledgement")

  const contextBuilderSource = readSource("lib/growth/replies/reply-context-builder.ts")
  assert.match(contextBuilderSource, /buildReplyDraftContext/)
  assert.match(contextBuilderSource, /playbookInfluence/)
  assert.match(contextBuilderSource, /complianceFlags/)
  assert.doesNotMatch(contextBuilderSource, /provider_secret|api_key|password/i)
  assert.doesNotMatch(contextBuilderSource, /provider_payload/)

  const promptSource = readSource("lib/growth/replies/reply-prompt.ts")
  assert.match(promptSource, /buildReplyDraftSystemPrompt/)
  assert.match(promptSource, /fallbackReplyDraft/)
  assert.doesNotMatch(promptSource, /api_key|password/i)

  const sampleContext = {
    companyLabel: "Acme Corp",
    contactLabel: "Alex",
    threadSubject: "Re: Pricing",
    inboundPreview: "Can you share pricing?",
    classification: "positive_interest",
    engagementSummary: "Warm engagement",
    complianceFlags: [],
    sequenceActive: false,
    playbookInfluence: ["Keep tone concise"],
    marketSignals: ["Hiring signal"],
    draftType: "positive_interest_reply" as const,
  }
  assert.match(buildReplyDraftSystemPrompt(sampleContext), /human review/i)
  assert.match(buildReplyDraftUserPrompt(sampleContext), /Acme Corp/)
  assert.doesNotMatch(buildReplyDraftUserPrompt(sampleContext), /uuid|gen_random_uuid/i)
  const fallback = fallbackReplyDraft(sampleContext)
  assert.ok(fallback.body.length > 0)
  assert.ok(fallback.confidence >= 0)

  const blockedNoInbound = await evaluateReplyRiskGuard({} as never, {
    leadId: "lead-1",
    threadStatus: "open",
    hasInboundMessage: false,
  })
  assert.equal(blockedNoInbound.allowed, false)
  assert.equal(blockedNoInbound.blockCode, "no_inbound_context")

  const blockedThread = await evaluateReplyRiskGuard({} as never, {
    leadId: "lead-1",
    threadStatus: "archived",
    hasInboundMessage: true,
  })
  assert.equal(blockedThread.allowed, false)
  assert.equal(blockedThread.blockCode, "thread_closed")

  const blockedUnsubscribe = await evaluateReplyRiskGuard({} as never, {
    leadId: "lead-1",
    threadStatus: "open",
    hasInboundMessage: true,
    classification: "unsubscribe",
  })
  assert.equal(blockedUnsubscribe.allowed, false)
  assert.equal(blockedUnsubscribe.blockCode, "unsubscribe_detected")

  const allowed = await evaluateReplyRiskGuard({} as never, {
    leadId: "lead-1",
    threadStatus: "open",
    hasInboundMessage: true,
    classification: "positive_interest",
  })
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.riskLevel, "low")

  assert.throws(() =>
    assertReplyDraftApproved({
      status: "draft",
      requiresHumanReview: true,
      humanApproved: true,
      humanApprovalConfirmed: true,
    }),
  )
  assert.throws(() =>
    assertReplyDraftApproved({
      status: "approved",
      requiresHumanReview: true,
      humanApproved: false,
      humanApprovalConfirmed: false,
    }),
  )
  assert.doesNotThrow(() =>
    assertReplyDraftApproved({
      status: "approved",
      requiresHumanReview: true,
      humanApproved: true,
      humanApprovalConfirmed: true,
    }),
  )

  const repositorySource = readSource("lib/growth/replies/reply-draft-repository.ts")
  assert.match(repositorySource, /generateInboxReplyDraft/)
  assert.match(repositorySource, /evaluateReplyRiskGuard/)
  assert.match(repositorySource, /runGrowthAiCopilotGeneration/)
  assert.match(repositorySource, /GROWTH_REPLY_DRAFT_AI_TASK/)
  assert.match(repositorySource, /approveReplyDraft/)
  assert.match(repositorySource, /discardReplyDraft/)
  assert.match(repositorySource, /sendApprovedReplyDraft/)
  assert.match(repositorySource, /assertReplyDraftApproved/)
  assert.match(repositorySource, /assertPreSendSuppressionAllowed/)
  assert.match(repositorySource, /executeTransportSend/)
  assert.match(repositorySource, /human_approved: true/)
  assert.match(repositorySource, /requires_human_review: true/)
  const approveBlock = repositorySource.slice(
    repositorySource.indexOf("export async function approveReplyDraft"),
    repositorySource.indexOf("export async function discardReplyDraft"),
  )
  assert.doesNotMatch(approveBlock, /executeTransportSend/)

  const sendBuilderSource = readSource("lib/growth/replies/reply-send-builder.ts")
  assert.match(sendBuilderSource, /draft\.status !== "approved"/)
  assert.match(sendBuilderSource, /resolveSequenceExecutionSender/)
  assert.match(sendBuilderSource, /applyOutboundEmailTracking/)

  const eventsSource = readSource("lib/growth/replies/reply-draft-events.ts")
  assert.match(eventsSource, /recordReplyDraftPlatformTimeline/)
  assert.match(eventsSource, /recordReplyDraftLeadTimeline/)
  assert.match(eventsSource, /insertReplyDraftEvent/)

  const tasksSource = readSource("lib/ai/tasks.ts")
  assert.match(tasksSource, /growth_reply_draft_generation/)

  const generateRouteSource = readSource("app/api/platform/growth/replies/drafts/generate/route.ts")
  assert.match(generateRouteSource, /requireGrowthEnginePlatformAccess/)
  assert.match(generateRouteSource, /isGrowthAiReplyDraftingSchemaReady/)
  assert.doesNotMatch(generateRouteSource, /executeTransportSend/)

  const approveRouteSource = readSource("app/api/platform/growth/replies/drafts/[id]/approve/route.ts")
  assert.match(approveRouteSource, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(approveRouteSource, /executeTransportSend/)

  const sendRouteSource = readSource("app/api/platform/growth/replies/drafts/[id]/send/route.ts")
  assert.match(sendRouteSource, /humanApprovalConfirmed/)
  assert.match(sendRouteSource, /sendApprovedReplyDraft/)

  const panelSource = readSource("components/growth/growth-reply-drafting-panel.tsx")
  assert.match(panelSource, /GROWTH_AI_REPLY_DRAFTING_QA_MARKER/)
  assert.match(panelSource, /Generate Reply Draft/)
  assert.match(panelSource, /Approve Draft/)
  assert.match(panelSource, /Discard Draft/)
  assert.match(panelSource, /Send Approved Reply/)
  assert.doesNotMatch(panelSource, /api_key|secret|password/i)

  const dashboardSource = readSource("components/growth/growth-reply-drafts-dashboard.tsx")
  assert.match(dashboardSource, /Drafts pending review/)
  assert.match(dashboardSource, /Approved drafts/)
  assert.match(dashboardSource, /Sent drafts/)
  assert.match(dashboardSource, /Blocked drafts/)
  assert.match(dashboardSource, /Top classifications/)
  assert.match(dashboardSource, /Risk distribution/)

  console.log("growth ai reply drafting tests passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
