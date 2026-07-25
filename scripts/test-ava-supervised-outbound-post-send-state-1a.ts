/**
 * AVA-SUPERVISED-OUTBOUND-POST-SEND-STATE-1A — Post-send Home projection certification.
 *
 * Run:
 *   pnpm test:ava-supervised-outbound-post-send-state-1a
 */
import assert from "node:assert/strict"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import { emptyCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { resolveCanonicalApprovalQueueCount } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import { AVA_SUPERVISED_CUTOVER_GENERATION_MODE } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isReviewableSupervisedAvaGeneration,
  isSupervisedAvaGenerationSent,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"

const CERTIFICATION_ID = "ava-supervised-outbound-post-send-state-1a-v1" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const OTHER_LEAD_ID = "00000000-0000-4000-8000-000000000002"

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function supervisedDraft(
  leadId: string,
  overrides: Partial<GrowthAiCopilotGeneration> = {},
): GrowthAiCopilotGeneration {
  return {
    id: overrides.id ?? `gen-${leadId}`,
    leadId,
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [
        {
          name: "Jane Smith",
          email: "jane@example.com",
          contactabilityStatus: "contactable",
        },
      ],
    },
    generatedContent: "Hello Jane, ...",
    generatedSubject: "Partnership opportunity",
    classification: {
      primary: "pursue",
      generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
      outboundSendAuthorized: false,
      rationale: "Strong fit.",
      recommendedContact: { name: "Jane Smith", email: "jane@example.com" },
    },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function sentGeneration(
  leadId: string,
  overrides: Partial<GrowthAiCopilotGeneration> = {},
): GrowthAiCopilotGeneration {
  const sentAt = "2026-07-24T18:00:00.000Z"
  return supervisedDraft(leadId, {
    id: overrides.id ?? `gen-sent-${leadId}`,
    status: "approved",
    approvedAt: sentAt,
    approvedBy: "operator-1",
    sentAt,
    classification: {
      primary: "pursue",
      generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
      outboundSendAuthorized: true,
      rationale: "Strong fit.",
      recommendedContact: { name: "Jane Smith", email: "jane@example.com" },
      avaSupervisedOutboundSendLifecycle: {
        qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
        status: "sent",
        claimedAt: sentAt,
        claimedBy: "operator-1",
        sendAttemptId: "attempt-1",
        completedAt: sentAt,
      },
      avaSupervisedOutboundSendReceipt: {
        qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
        generationId: overrides.id ?? `gen-sent-${leadId}`,
        deliveryAttemptId: "delivery-1",
        providerMessageId: "provider-1",
        senderAccountId: "sender-1",
        recipientEmail: "jane@example.com",
        subject: "Partnership opportunity",
        bodyFingerprint: "fp-1",
        signatureProfileId: null,
        signatureResolutionSource: null,
        signatureInjected: true,
        sentAt,
        status: "sent",
      },
    },
    ...overrides,
  })
}

function legacyBlitzPackage() {
  return {
    itemId: "legacy-hac:blitz",
    packageId: "pkg-blitz",
    leadId: BLITZ_LEAD_ID,
    companyName: "Blitz Industries (Transport Fidelity Cert)",
    decisionMaker: null,
    draftCount: 1,
    preparedAt: "2026-07-24T12:00:00.000Z",
    preparedAgoLabel: "Prepared 2 hours ago",
    channelLabel: "Subject: Transport fidelity",
    statusLabel: "Ready for review",
    reviewHref: `/growth/leads/crm?open=${BLITZ_LEAD_ID}`,
  }
}

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-SUPERVISED-OUTBOUND-POST-SEND-STATE-1A certification`)

  runGate("Sent supervised generation is not reviewable", () => {
    const sent = sentGeneration(BLITZ_LEAD_ID)
    assert.equal(isSupervisedAvaGenerationSent(sent), true)
    assert.equal(isReviewableSupervisedAvaGeneration(sent), false)
  })

  runGate("Single successful send removes lead from Ready for Review", () => {
    const sent = sentGeneration(BLITZ_LEAD_ID)
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [sent],
      leadsById: new Map([[BLITZ_LEAD_ID, "Blitz Industries"]]),
    })
    assert.deepEqual(attention.readyForReview, [])
    assert.deepEqual(attention.sentLeadIds, [BLITZ_LEAD_ID])
  })

  runGate("Older draft does not resurface after newer send on same lead", () => {
    const sent = sentGeneration(BLITZ_LEAD_ID, { id: "gen-sent-newest" })
    const olderDraft = supervisedDraft(BLITZ_LEAD_ID, {
      id: "gen-draft-older",
      createdAt: "2026-07-23T12:00:00.000Z",
    })
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [sent, olderDraft],
      leadsById: new Map([[BLITZ_LEAD_ID, "Blitz Industries"]]),
    })
    assert.equal(attention.readyForReview.length, 0)
    assert.equal(attention.sentLeadIds.length, 1)
  })

  runGate("Multiple queued recommendations decrease count after one send", () => {
    const sent = sentGeneration(BLITZ_LEAD_ID)
    const blockDraft = supervisedDraft(BLOCK_IMAGING_LEAD_ID, {
      id: "gen-block",
      generatedSubject: "Imaging partnership",
    })

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [sent, blockDraft],
      leadsById: new Map([
        [BLITZ_LEAD_ID, "Blitz Industries"],
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
      ]),
    })
    assert.equal(attention.readyForReview.length, 1)
    assert.equal(attention.readyForReview[0]?.companyName, "Block Imaging")

    const merged = mergeSupervisedAvaIntoApprovalSnapshot({
      base: emptyCanonicalOperatorApprovalSnapshot(),
      attention,
    })
    assert.equal(resolveCanonicalApprovalQueueCount(merged, 0), 1)
    assert.ok(!merged.packages.some((row) => row.leadId === BLITZ_LEAD_ID))
  })

  runGate("Legacy canonical package for sent lead is filtered from Home approval snapshot", () => {
    const sent = sentGeneration(BLITZ_LEAD_ID)
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [sent],
      leadsById: new Map([[BLITZ_LEAD_ID, "Blitz Industries"]]),
    })

    const legacy = emptyCanonicalOperatorApprovalSnapshot()
    legacy.packages = [legacyBlitzPackage()]
    legacy.topPackage = legacy.packages[0] ?? null
    legacy.outreachPackageCount = 1
    legacy.pendingApprovalCount = 1
    legacy.waitingForOperator = true

    const merged = mergeSupervisedAvaIntoApprovalSnapshot({ base: legacy, attention })
    assert.equal(merged.packages.length, 0)
    assert.equal(merged.topPackage, null)
    assert.equal(resolveCanonicalApprovalQueueCount(merged, 0), 0)
    assert.equal(merged.waitingForOperator, false)
  })

  runGate("Last recommendation sent clears approval queue and promotes next lead", () => {
    const sentBlitz = sentGeneration(BLITZ_LEAD_ID)
    const blockDraft = supervisedDraft(BLOCK_IMAGING_LEAD_ID)

    const legacy = emptyCanonicalOperatorApprovalSnapshot()
    legacy.packages = [legacyBlitzPackage()]
    legacy.topPackage = legacy.packages[0] ?? null
    legacy.pendingApprovalCount = 1

    const attentionBefore = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockDraft, sentBlitz],
      leadsById: new Map([
        [BLITZ_LEAD_ID, "Blitz Industries"],
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
      ]),
    })
    assert.equal(attentionBefore.readyForReview.length, 1)

    const mergedBefore = mergeSupervisedAvaIntoApprovalSnapshot({
      base: legacy,
      attention: attentionBefore,
    })
    assert.equal(resolveCanonicalApprovalQueueCount(mergedBefore, 0), 1)
    assert.equal(mergedBefore.topPackage?.companyName, "Block Imaging")

    const sentBlock = sentGeneration(BLOCK_IMAGING_LEAD_ID, { id: "gen-sent-block" })
    const attentionAfter = buildSupervisedAvaHomeOperatorAttention({
      generations: [sentBlock, sentBlitz],
      leadsById: new Map([
        [BLITZ_LEAD_ID, "Blitz Industries"],
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
      ]),
    })
    const mergedAfter = mergeSupervisedAvaIntoApprovalSnapshot({
      base: legacy,
      attention: attentionAfter,
    })
    assert.equal(resolveCanonicalApprovalQueueCount(mergedAfter, 0), 0)
    assert.equal(mergedAfter.topPackage, null)
  })

  runGate("Refresh after send rebuilds identical projection from persisted generations", () => {
    const generations = [
      sentGeneration(BLITZ_LEAD_ID),
      supervisedDraft(OTHER_LEAD_ID, { id: "gen-other" }),
    ]
    const leadsById = new Map([
      [BLITZ_LEAD_ID, "Blitz Industries"],
      [OTHER_LEAD_ID, "Other Co"],
    ])

    const first = buildSupervisedAvaHomeOperatorAttention({ generations, leadsById })
    const second = buildSupervisedAvaHomeOperatorAttention({ generations, leadsById })

    assert.deepEqual(first.readyForReview.map((row) => row.generationId), second.readyForReview.map((row) => row.generationId))
    assert.deepEqual(first.sentLeadIds, second.sentLeadIds)
    assert.equal(first.readyForReview.length, 1)
    assert.equal(first.readyForReview[0]?.companyName, "Other Co")
  })

  runGate("Dashboard count matches merged approval snapshot after send", () => {
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [
        sentGeneration(BLITZ_LEAD_ID),
        supervisedDraft(BLOCK_IMAGING_LEAD_ID),
      ],
      leadsById: new Map([
        [BLITZ_LEAD_ID, "Blitz Industries"],
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
      ]),
    })

    const legacy = emptyCanonicalOperatorApprovalSnapshot()
    legacy.packages = [legacyBlitzPackage()]
    legacy.pendingApprovalCount = 2
    legacy.outreachPackageCount = 2

    const merged = mergeSupervisedAvaIntoApprovalSnapshot({ base: legacy, attention })
    const count = resolveCanonicalApprovalQueueCount(merged, 0)
    assert.equal(count, 1)
    assert.equal(
      count > 0
        ? `${count} ${count === 1 ? "email draft" : "email drafts"} ready for review`
        : null,
      "1 email draft ready for review",
    )
  })

  console.log(`\n[${CERTIFICATION_ID}] PASS`)
}

main()
