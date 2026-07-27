/**
 * AVA-BLOCK-IMAGING-APPROVE-ACTION-HOTFIX-1A — Certification tests.
 *
 *   pnpm test:ava-block-imaging-approve-action-hotfix-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { mapAvaSupervisedOutboundApproveError } from "../lib/growth/ava-reasoning/ava-supervised-outbound-approve-errors-core"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"

const CERT_ID = "ava-block-imaging-approve-action-hotfix-1a-v1" as const

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

function supervisedDraft(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: "gen-draft-1",
    leadId: "lead-1",
    generationType: "cold_email",
    promptVariant: "default",
    promptVersion: "v1",
    generatedContent: "Hello Josh,\n\nPrepared body.",
    generatedSubject: "Subject line",
    status: "draft",
    classification: {
      primary: "pursue",
      avaSupervisedOutbound: true,
    },
    inputSnapshot: {},
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    ...overrides,
  } as GrowthAiCopilotGeneration
}

console.log(`[${CERT_ID}] AVA-BLOCK-IMAGING-APPROVE-ACTION-HOTFIX-1A certification`)

{
  const copilot = readSource("components/growth/growth-ai-copilot.tsx")
  const review = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
  const approveRoute = readSource("app/api/platform/growth/copilot/generations/[generationId]/route.ts")
  const approveService = readSource("lib/growth/run-ai-copilot-generation.ts")
  const signatureRoute = readSource(
    "app/api/platform/growth/copilot/generations/[generationId]/signature-preview/route.ts",
  )
  const senderRepo = readSource("lib/growth/sender-pools/sender-pool-repository.ts")
  const homePreview = readSource("lib/growth/home/growth-home-review-queue-preview-client-1b.ts")

  assert.match(copilot, /mapAvaSupervisedOutboundApproveError/)
  assert.match(copilot, /await load\(\)/)
  assert.match(copilot, /setApprovalError/)
  assert.match(review, /Approving\.\.\./)
  assert.match(review, /approvalError/)
  assert.match(review, /Signature will be applied from the assigned sending mailbox at send time/)
  assert.match(approveRoute, /approvalPresentation/)
  assert.match(approveService, /skipSupervisedApprovalInvalidation: true/)
  assert.match(approveService, /bindAvaSupervisedOutboundApproval/)
  assert.match(approveService, /updateGrowthAiCopilotGenerationStatus/)
  assert.match(signatureRoute, /readAvaSupervisedOutboundApprovalBinding/)
  assert.match(signatureRoute, /Signature will be applied from the assigned sending mailbox at send time/)
  assert.match(senderRepo, /normalizeSenderRotationDecisionReasonForPersistence/)
  assert.match(homePreview, /mapAvaSupervisedOutboundApproveError/)
  assert.match(homePreview, /readAvaSupervisedOutboundApprovalBinding/)
  console.log("  ✓ Approve click invokes canonical approval path with refresh + failure UX")
}

{
  const draft = supervisedDraft()
  const presentation = resolveAvaSupervisedOutboundApprovalPresentation(draft)
  assert.equal(presentation.showApproveEmailAction, true)
  assert.equal(presentation.showSendEmailAction, false)
  console.log("  ✓ Send hidden before binding")
}

{
  const approved = supervisedDraft({
    status: "approved",
    classification: {
      primary: "pursue",
      avaSupervisedOutbound: true,
      avaSupervisedOutboundApproval: {
        qaMarker: "ava-supervised-outbound-1a-v1",
        generationId: "gen-draft-1",
        organizationId: "org-1",
        recipientEmail: "josh@example.com",
        subject: "Subject line",
        unsignedBody: "Hello Josh,\n\nPrepared body.",
        bodyFingerprint: "fp",
        senderAccountId: "sender-1",
        senderAssignmentId: "assign-1",
        mailboxConnectionId: "mb-1",
        senderEmail: "ava@equipify.ai",
        assignmentSource: "sender_pool",
        assignmentStrategy: "weighted_health",
        senderPoolId: "pool-1",
        signatureProfileId: "sig-1",
        signatureResolutionSource: "sender_profile",
        approvedAt: new Date().toISOString(),
        approvedBy: "user-1",
      },
    },
  })
  const presentation = resolveAvaSupervisedOutboundApprovalPresentation(approved)
  assert.equal(hasValidMessageApprovalBindingForGeneration(approved), true)
  assert.equal(presentation.sendEligible, true)
  assert.equal(presentation.showSendEmailAction, true)
  console.log("  ✓ Send appears only with valid binding")
}

{
  const message = mapAvaSupervisedOutboundApproveError({
    error: "approve_failed",
    message: 'new row for relation "sender_rotation_decisions" violates check constraint',
    status: 500,
  })
  assert.match(message, /Sender assignment failed/)
  console.log("  ✓ Approval failure surfaces operator-safe message")
}

{
  const service = readSource("lib/growth/run-ai-copilot-generation.ts")
  const bindIndex = service.indexOf("bindAvaSupervisedOutboundApproval")
  const statusIndex = service.indexOf("updateGrowthAiCopilotGenerationStatus", bindIndex)
  assert.ok(bindIndex >= 0 && statusIndex > bindIndex)
  console.log("  ✓ Binding occurs before approved status for supervised drafts")
}

console.log(`[${CERT_ID}] PASS`)
