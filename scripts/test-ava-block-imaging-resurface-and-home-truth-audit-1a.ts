/**
 * AVA-BLOCK-IMAGING-RESURFACE-AND-HOME-TRUTH-AUDIT-1A — Lifecycle agreement certification.
 * Run: pnpm test:ava-block-imaging-resurface-and-home-truth-audit-1a
 */
import assert from "node:assert/strict"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { emptyCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  resolveCanonicalApprovalQueueCount,
  resolveCanonicalApprovedReadyToSendCount,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { fingerprintAvaSupervisedOutboundBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isReviewableSupervisedAvaGeneration,
  isSendEligibleSupervisedAvaGeneration,
  isSupervisedAvaGenerationSent,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { findExistingAvaSupervisedSendableDraft, isSendableAvaSupervisedDraft } from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import {
  buildGrowthHomeReviewQueueDailyBrief,
  buildGrowthHomeReviewQueuePresentation,
  buildSupervisedReadyByLeadIdMap,
} from "@/lib/growth/home/growth-home-review-queue-1b"
import {
  buildGrowthHomeCurrentFocusPresentation,
  buildGrowthHomeDailyBriefPresentation,
} from "@/lib/growth/home/growth-home-simplification-1a"
import { buildHeroExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

const QA_MARKER = "ava-block-imaging-resurface-and-home-truth-audit-1a-v1" as const
const LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function draftGeneration(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    leadId: LEAD_ID,
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [{ contactId: "c1", name: "Josh Block", email: "josh@example.com", contactabilityStatus: "contactable" }],
    },
    generatedContent: "Hi Josh,\n\nBody.",
    generatedSubject: "Block Imaging service operations",
    classification: { primary: "pursue", generationMode: "ava_direct_production_cutover_1a" },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: "2026-07-27T02:38:51.367187+00:00",
    ...overrides,
  }
}

function approvedGeneration(): GrowthAiCopilotGeneration {
  const body = "Hi Josh,\n\nBody."
  const binding = {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
    generationId: "22222222-2222-4222-8222-222222222222",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    recipientEmail: "josh@example.com",
    subject: "Block Imaging service operations",
    unsignedBody: body,
    bodyFingerprint: fingerprintAvaSupervisedOutboundBody(body),
    senderAccountId: "sender-1",
    senderEmail: "ava@equipifyai.com",
    approvedAt: "2026-07-27T03:14:17.292Z",
    approvedBy: "operator-1",
  }
  return draftGeneration({
    id: "22222222-2222-4222-8222-222222222222",
    status: "approved",
    approvedAt: binding.approvedAt,
    approvedBy: binding.approvedBy,
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      avaSupervisedOutboundApproval: binding,
      outboundSendAuthorized: true,
    },
  })
}

function sentGeneration(): GrowthAiCopilotGeneration {
  const sentAt = "2026-07-27T04:00:00.000Z"
  return {
    ...approvedGeneration(),
    id: "33333333-3333-4333-8333-333333333333",
    sentAt,
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      outboundSendAuthorized: true,
      avaSupervisedOutboundSendLifecycle: {
        qaMarker: "ava-supervised-outbound-1b-v1",
        status: "sent",
        claimedAt: sentAt,
        claimedBy: "operator-1",
        sendAttemptId: "attempt-1",
      },
    },
  }
}

function buildQueueFromGenerations(generations: GrowthAiCopilotGeneration[]) {
  const attention = buildSupervisedAvaHomeOperatorAttention({
    generations,
    leadsById: new Map([[LEAD_ID, "Block Imaging"]]),
  })
  const snapshot = mergeSupervisedAvaIntoApprovalSnapshot({
    base: emptyCanonicalOperatorApprovalSnapshot(),
    attention,
  })
  const queue = buildGrowthHomeReviewQueuePresentation({
    packages: snapshot.packages,
    supervisedReadyByLeadId: buildSupervisedReadyByLeadIdMap(
      attention.readyForReview,
      attention.approvedReadyToSend,
    ),
  })
  return { attention, snapshot, queue }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const draft = draftGeneration()
  const approved = approvedGeneration()
  const sent = sentGeneration()

  assert.equal(isReviewableSupervisedAvaGeneration(draft), true)
  assert.equal(isSendEligibleSupervisedAvaGeneration(approved), true)
  assert.equal(isSupervisedAvaGenerationSent(sent), true)
  console.log("  ✓ canonical resolver distinguishes draft / approved-unsent / sent")

  const draftBundle = buildQueueFromGenerations([draft])
  assert.equal(resolveCanonicalApprovalQueueCount(draftBundle.snapshot, 0), 1)
  assert.equal(resolveCanonicalApprovedReadyToSendCount(draftBundle.snapshot, 0), 0)
  const draftFocus = buildGrowthHomeCurrentFocusPresentation({
    pendingApprovals: 1,
    approvedReadyToSend: 0,
    recommendation: null,
    waitingItem: null,
    runtimeTrust: null,
    actionableCompanyName: "Block Imaging",
  })
  assert.equal(draftFocus?.statusLabel, "Waiting for your approval")
  assert.equal(draftFocus?.nextActionLabel, "Review prepared outreach")
  console.log("  ✓ draft + no binding → Awaiting approval / Approve")

  const approvedBundle = buildQueueFromGenerations([approved])
  assert.equal(resolveCanonicalApprovalQueueCount(approvedBundle.snapshot, 0), 0)
  assert.equal(resolveCanonicalApprovedReadyToSendCount(approvedBundle.snapshot, 0), 1)
  const approvedRow = approvedBundle.queue.rows[0]
  assert.equal(approvedRow?.showSendEmailAction, true)
  assert.equal(approvedRow?.showApproveEmailAction, false)
  const approvedFocus = buildGrowthHomeCurrentFocusPresentation({
    pendingApprovals: 0,
    approvedReadyToSend: 1,
    recommendation: null,
    waitingItem: null,
    runtimeTrust: null,
    actionableCompanyName: "Block Imaging",
  })
  assert.equal(approvedFocus?.statusLabel, "Ready to send")
  assert.equal(approvedFocus?.nextActionLabel, "Send approved email")
  const approvedHero = buildHeroExecutiveBriefing({
    statusLabel: "Working",
    pendingApprovals: 0,
    approvedReadyToSend: 1,
  })
  assert.match(approvedHero.narrative, /approved email is ready to send/i)
  assert.doesNotMatch(approvedHero.narrative, /draft.*ready for your review/i)
  const approvedDailyBrief = buildGrowthHomeDailyBriefPresentation({
    pendingApprovals: 0,
    approvedReadyToSend: 1,
    recommendation: null,
    waitingItem: null,
    runtimeTrust: null,
  })
  assert.match(approvedDailyBrief.accomplishmentLine ?? "", /ready to send/i)
  const approvedQueueBrief = buildGrowthHomeReviewQueueDailyBrief({ queue: approvedBundle.queue })
  assert.doesNotMatch(approvedQueueBrief.accomplishmentLine ?? "", /for your review/i)
  assert.match(approvedQueueBrief.recommendSendLine ?? "", /ready to send/i)
  console.log("  ✓ approved + valid binding + unsent → Approved / Send and aligned hero/focus")

  const sentBundle = buildQueueFromGenerations([sent, approved])
  assert.equal(sentBundle.attention.readyForReview.length, 0)
  assert.equal(sentBundle.attention.approvedReadyToSend.length, 0)
  assert.ok(sentBundle.attention.sentLeadIds.includes(LEAD_ID))
  assert.equal(sentBundle.queue.rows.length, 0)
  console.log("  ✓ sent → absent from actionable Home")

  const discarded = draftGeneration({
    id: "44444444-4444-4444-8444-444444444444",
    status: "discarded",
  })
  const resurfacingBundle = buildQueueFromGenerations([discarded, approved])
  assert.equal(resurfacingBundle.queue.rows.length, 1)
  assert.equal(resurfacingBundle.queue.rows[0]?.packageId, approved.id)
  console.log("  ✓ discarded/superseded generations never resurface over actionable work")

  assert.equal(
    isSendableAvaSupervisedDraft({
      decision: "pursue",
      email: { subject: "S", body: "B" },
      recommendedContact: { contactId: "c1", name: "Josh", email: "josh@example.com" },
      contactsSupplied: [{ contactId: "c1", name: "Josh", email: "josh@example.com", contactabilityStatus: "contactable" }],
    }),
    true,
  )
  assert.equal(typeof findExistingAvaSupervisedSendableDraft, "function")
  console.log("  ✓ duplicate reuse guard exists for first-touch draft persistence")

  console.log(`\n[${QA_MARKER}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
