/**
 * AVA-SUPERVISED-OUTBOUND-1B — Atomic send claim certification (no live send).
 *
 * Run: pnpm test:ava-supervised-outbound-1b
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
  buildAvaSupervisedOutboundSendClaim,
  readAvaSupervisedOutboundSendLifecycle,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import { detectAvaSupervisedApprovalContentDrift } from "../lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import type { AvaSupervisedOutboundApprovalBinding } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"

const CERTIFICATION_ID = AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER

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

function sampleGeneration(overrides?: Partial<GrowthAiCopilotGeneration>): GrowthAiCopilotGeneration {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    leadId: "22222222-2222-4222-8222-222222222222",
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {},
    generatedContent: "Hi Mike,\n\nCertification body.",
    generatedSubject: "AVA-SUPERVISED-OUTBOUND-1B certification",
    classification: {
      generationMode: "ava_direct_production_cutover_1a",
      recommendedContact: { email: "mike@blitzind.com", name: "Mike Short" },
    },
    status: "approved",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: "2026-07-24T12:00:00.000Z",
    approvedBy: "33333333-3333-4333-8333-333333333333",
    sentAt: null,
    createdBy: null,
    createdAt: "2026-07-24T11:00:00.000Z",
    ...overrides,
  }
}

function sampleBinding(
  overrides?: Partial<AvaSupervisedOutboundApprovalBinding>,
): AvaSupervisedOutboundApprovalBinding {
  return {
    qaMarker: "ava-supervised-outbound-1a-v1",
    generationId: "11111111-1111-4111-8111-111111111111",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    recipientEmail: "mike@blitzind.com",
    subject: "AVA-SUPERVISED-OUTBOUND-1B certification",
    unsignedBody: "Hi Mike,\n\nCertification body.",
    bodyFingerprint: "sample-fingerprint",
    senderAccountId: "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720",
    signatureProfileId: null,
    signatureResolutionSource: "default",
    approvedAt: "2026-07-24T12:00:00.000Z",
    approvedBy: "33333333-3333-4333-8333-333333333333",
    ...overrides,
  }
}

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-SUPERVISED-OUTBOUND-1B focused certification`)

  runGate("1A duplicate-send was read-then-send; 1B adds atomic claim RPC with row lock", () => {
    const migration = readSource(
      "supabase/migrations/20270724153000_ava_supervised_outbound_send_claim_1b.sql",
    )
    assert.match(migration, /claim_ava_supervised_outbound_send/)
    assert.match(migration, /for update/)
    assert.match(migration, /send_in_progress/)
    assert.match(migration, /delivery_unknown_requires_reconciliation/)
    assert.match(
      readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts"),
      /claimAvaSupervisedOutboundSend/,
    )
    assert.doesNotMatch(
      readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts"),
      /\.is\("sent_at", null\)/,
    )
  })

  runGate("Lifecycle is approved → sending → sent with failure terminals", () => {
    const claim = buildAvaSupervisedOutboundSendClaim({
      claimedBy: "user-1",
      sendAttemptId: "attempt-1",
    })
    assert.equal(claim.status, "sending")
    assert.equal(claim.qaMarker, AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER)

    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.match(sendService, /finalizeAvaSupervisedOutboundSendClaim/)
    assert.match(sendService, /releaseAvaSupervisedOutboundSendClaim/)
    assert.match(sendService, /lifecycleStatus: "failed"/)
    assert.match(sendService, /lifecycleStatus: "delivery_unknown"/)
    assert.match(sendService, /status: "sent"/)

    const lifecycle = readAvaSupervisedOutboundSendLifecycle({
      avaSupervisedOutboundSendLifecycle: claim,
    })
    assert.ok(lifecycle)
    assert.equal(lifecycle?.status, "sending")
  })

  runGate("Ambiguous provider acceptance without receipt persistence becomes delivery_unknown", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.match(sendService, /delivery_unknown_persist_failed/)
    assert.match(sendService, /status: "delivery_unknown"/)
    assert.match(sendService, /delivery_unknown_requires_reconciliation/)
    assert.doesNotMatch(sendService, /retry.*transport/i)
  })

  runGate("Frozen approval bundle is verified before transport", () => {
    const bundle = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification.ts")
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.match(bundle, /approval_binding_generation_mismatch/)
    assert.match(bundle, /approval_binding_organization_mismatch/)
    assert.match(bundle, /approval_subject_stale/)
    assert.match(bundle, /approval_body_stale/)
    assert.match(bundle, /approval_body_fingerprint_mismatch/)
    assert.match(bundle, /approval_sender_mismatch/)
    assert.match(bundle, /approval_signature_profile_stale/)
    assert.match(bundle, /approval_recipient_stale/)
    assert.match(sendService, /verifyAvaSupervisedOutboundApprovalBundle/)
    assert.match(sendService, /approved_body_mismatch/)
  })

  runGate("Send route requires growth access — generation id alone is insufficient", () => {
    const sendRoute = readSource("app/api/platform/growth/copilot/generations/[generationId]/send/route.ts")
    const auth = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-authorization.ts")
    assert.match(sendRoute, /requireGrowthAccess/)
    assert.match(sendRoute, /actorOrganizationId/)
    assert.match(sendRoute, /isPlatformAdmin/)
    assert.match(auth, /tenant_isolation_violation/)
    assert.match(auth, /isLeadInPortfolioOrganizationScope/)
  })

  runGate("Editing approved subject, body, or recipient invalidates approval", () => {
    const repo = readSource("lib/growth/ai-copilot-repository.ts")
    assert.match(repo, /invalidateAvaSupervisedApprovalOnContentChange/)
    assert.match(repo, /status: "draft"/)

    const generation = sampleGeneration()
    const binding = sampleBinding()
    assert.equal(
      detectAvaSupervisedApprovalContentDrift({
        generation,
        binding,
        unsignedBody: binding.unsignedBody,
      }),
      false,
    )
    assert.equal(
      detectAvaSupervisedApprovalContentDrift({
        generation: { ...generation, generatedSubject: "Changed subject" },
        binding,
        unsignedBody: binding.unsignedBody,
      }),
      true,
    )
    assert.equal(
      detectAvaSupervisedApprovalContentDrift({
        generation,
        binding,
        unsignedBody: "Different body",
      }),
      true,
    )
    assert.equal(
      detectAvaSupervisedApprovalContentDrift({
        generation: {
          ...generation,
          classification: {
            ...(generation.classification as Record<string, unknown>),
            recommendedContact: { email: "other@example.com" },
          },
        },
        binding,
        unsignedBody: binding.unsignedBody,
      }),
      true,
    )
  })

  runGate("Signature boundary remains single-append at transport", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    const boundary = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary.ts")
    assert.match(sendService, /prepareAvaSupervisedOutboundTransportEmail/)
    assert.match(
      sendService,
      /from "@\/lib\/growth\/ava-reasoning\/ava-supervised-outbound-signature-boundary"/,
    )
    assert.match(boundary, /stripAccidentalAvaSignatureFromBody/)
    assert.match(boundary, /plaintext_signature_boundary_count_invalid/)
    assert.match(sendService, /binding\.unsignedBody/)
  })

  runGate("UI surfaces sent and delivery_unknown terminal states", () => {
    const review = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
    const copilot = readSource("components/growth/growth-ai-copilot.tsx")
    assert.match(review, /Delivery unknown/)
    assert.match(review, /readAvaSupervisedOutboundSendLifecycle/)
    assert.match(copilot, /resolveAvaSupervisedOutboundApprovalPresentation/)
  })

  runGate("Production probe uses Vercel Production env workflow (no .env.local requirement)", () => {
    const probe = readSource("scripts/probe-ava-supervised-outbound-1b.ts")
    assert.match(probe, /bootstrapGrowthOperatorNotificationsCertEnv/)
    assert.match(probe, /requireVercelProductionEnvRun: true/)
    assert.match(probe, /mike@blitzind.com/)
    assert.doesNotMatch(probe, /\.env\.local/)
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
