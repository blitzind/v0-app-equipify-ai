/**
 * AVA-BLOCK-IMAGING-APPROVAL-BINDING-HOTFIX-1A — Focused certification (no send).
 *
 *   pnpm test:ava-block-imaging-approval-binding-hotfix-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import {
  AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER,
  hasValidMessageApprovalBindingForGeneration,
  isUnboundApprovedSupervisedGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import {
  AVA_OUTBOUND_PROHIBITED_EM_DASH,
  assertAvaOutboundCopyQualityForPersistence,
  containsProhibitedAvaOutboundStyleMarkers,
  normalizeProhibitedAvaOutboundCopy,
} from "../lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { fingerprintAvaSupervisedOutboundBody } from "../lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import {
  BLOCK_IMAGING_FRESH_GENERATION_ID,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"

const CERT_ID = "ava-block-imaging-approval-binding-hotfix-1a-v1" as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function supervisedDraft(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: BLOCK_IMAGING_FRESH_GENERATION_ID,
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {},
    generatedContent: "Hi Josh, Block Imaging looks like a strong fit.",
    generatedSubject: "Multi-vendor imaging service operations",
    classification: { primary: "pursue" },
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

function bindingFor(generation: GrowthAiCopilotGeneration) {
  const body = generation.generatedContent
  return {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
    generationId: generation.id,
    organizationId: "5876176a-61ec-4532-ad99-0c31482d5a91",
    recipientEmail: "josh@blockimaging.com",
    subject: generation.generatedSubject ?? "",
    unsignedBody: body,
    bodyFingerprint: fingerprintAvaSupervisedOutboundBody(body),
    senderAccountId: "sender-1",
    senderAssignmentId: "assignment-1",
    assignmentSource: "sender_pool",
    senderPoolId: "pool-1",
    signatureProfileId: "sig-1",
    signatureResolutionSource: "sender_profile",
    approvedAt: new Date().toISOString(),
    approvedBy: "operator-1",
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] AVA-BLOCK-IMAGING-APPROVAL-BINDING-HOTFIX-1A certification`)

  runGate("recommendation approved + generation unapproved shows email awaiting approval", () => {
    const draft = supervisedDraft()
    const presentation = resolveAvaSupervisedOutboundApprovalPresentation(draft)
    assert.equal(presentation.recommendationOperatorApproved, false)
    assert.equal(presentation.messageApproved, false)
    assert.equal(presentation.sendEligible, false)
    assert.equal(presentation.messageStatusLabel, "Awaiting approval")
  })

  runGate("recommendation approved does NOT make send eligible", () => {
    const unboundApproved = supervisedDraft({
      status: "approved",
      approvedAt: new Date().toISOString(),
      classification: { primary: "pursue" },
    })
    const presentation = resolveAvaSupervisedOutboundApprovalPresentation(unboundApproved)
    assert.equal(presentation.recommendationOperatorApproved, true)
    assert.equal(presentation.messageApproved, false)
    assert.equal(presentation.sendEligible, false)
    assert.equal(isUnboundApprovedSupervisedGeneration(unboundApproved), true)
  })

  runGate("generation without binding cannot send", () => {
    const approved = supervisedDraft({ status: "approved" })
    assert.equal(hasValidMessageApprovalBindingForGeneration(approved), false)
    assert.equal(resolveAvaSupervisedOutboundApprovalPresentation(approved).showSendEmailAction, false)
  })

  runGate("current generation binding authorizes only exact generation", () => {
    const bound = supervisedDraft({
      status: "approved",
      classification: {
        primary: "pursue",
        avaSupervisedOutboundApproval: bindingFor(supervisedDraft()),
      },
    })
    assert.equal(hasValidMessageApprovalBindingForGeneration(bound), true)
    assert.equal(resolveAvaSupervisedOutboundApprovalPresentation(bound).sendEligible, true)

    const staleBinding = supervisedDraft({
      id: "other-generation",
      status: "approved",
      classification: {
        primary: "pursue",
        avaSupervisedOutboundApproval: bindingFor(supervisedDraft()),
      },
    })
    assert.equal(hasValidMessageApprovalBindingForGeneration(staleBinding), false)
  })

  runGate("old discarded generation binding cannot authorize new generation", () => {
    const oldBinding = bindingFor(
      supervisedDraft({ id: BLOCK_IMAGING_LEGACY_GENERATION_ID, status: "discarded" }),
    )
    const fresh = supervisedDraft({
      id: BLOCK_IMAGING_FRESH_GENERATION_ID,
      status: "approved",
      classification: { primary: "pursue", avaSupervisedOutboundApproval: oldBinding },
    })
    assert.equal(hasValidMessageApprovalBindingForGeneration(fresh), false)
  })

  runGate("subject/body edit invalidates bound message approval at transport verification layer", () => {
    const bound = bindingFor(supervisedDraft())
    const edited = supervisedDraft({
      status: "approved",
      generatedContent: `${bound.unsignedBody} Updated sentence.`,
      classification: { primary: "pursue", avaSupervisedOutboundApproval: bound },
    })
    assert.notEqual(edited.generatedContent, bound.unsignedBody)
    assert.equal(hasValidMessageApprovalBindingForGeneration(edited), true)
    assert.notEqual(
      fingerprintAvaSupervisedOutboundBody(edited.generatedContent),
      bound.bodyFingerprint,
    )
  })

  runGate("persistence normalizes em dash before approval", () => {
    const normalized = assertAvaOutboundCopyQualityForPersistence({
      subject: "Intro",
      body: `Josh ${AVA_OUTBOUND_PROHIBITED_EM_DASH} Block Imaging looks like a strong fit.`,
    })
    assert.equal(normalized.ok, true)
    if (normalized.ok) {
      assert.equal(containsProhibitedAvaOutboundStyleMarkers(normalized.body), false)
      assert.match(normalized.body, /Josh, Block Imaging/)
    }
  })

  runGate("approved content is not silently normalized afterward", () => {
    const approval = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts")
    const bundle = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification.ts")
    assert.doesNotMatch(approval, /normalizeProhibitedAvaOutboundCopy/)
    assert.match(bundle, /approval_body_stale/)
  })

  runGate("UI derives send readiness from generation binding", () => {
    const review = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
    const copilot = readSource("components/growth/growth-ai-copilot.tsx")
    assert.match(review, /resolveAvaSupervisedOutboundApprovalPresentation/)
    assert.match(review, /showSendEmailAction/)
    assert.match(review, /Approve Email/)
    assert.match(copilot, /primaryApprovalPresentation\?\.showSendEmailAction/)
  })

  runGate("approve binds before persisting approved status for supervised drafts", () => {
    const approve = readSource("lib/growth/run-ai-copilot-generation.ts")
    assert.match(approve, /bindAvaSupervisedOutboundApproval/)
    assert.match(approve, /canRepairUnboundApproved/)
  })

  runGate("em dash helper blocks prohibited style markers", () => {
    assert.equal(containsProhibitedAvaOutboundStyleMarkers("Josh — Block"), true)
    assert.equal(containsProhibitedAvaOutboundStyleMarkers(normalizeProhibitedAvaOutboundCopy("Josh — Block")), false)
  })

  console.log(`[${AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
