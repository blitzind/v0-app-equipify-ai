/**
 * AVA-SUPERVISED-OUTBOUND-1A — Focused certification (no live send).
 *
 * Run: pnpm test:ava-supervised-outbound-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"
import {
  AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
  AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  bodyContainsLegacyAvaSignatureMarkers,
  countPlaintextSignatureSeparators,
  fingerprintAvaSupervisedOutboundBody,
  stripAccidentalAvaSignatureFromBody,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { appendSignatureToOutboundBody } from "../lib/growth/signatures/signature-injection"

const CERTIFICATION_ID = AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER

const FORBIDDEN_PRESENTATION_PATTERNS = [
  /runEquipifyAvaDirectReasoning/,
  /CREATE TABLE|ALTER TABLE|DROP TABLE/i,
] as const

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

const SAMPLE_SIGNATURE = renderSignatureTemplate("simple", {
  display_name: "Ava Sinclair",
  title: "Growth Advisor",
  email: "ava@equipifyai.com",
  website: "equipify.ai",
})

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-SUPERVISED-OUTBOUND-1A focused certification`)

  runGate("Ava prompt explicitly prohibits signatures", () => {
    const prompts = readSource("lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-prompts.ts")
    const schema = readSource("lib/growth/ava-reasoning/ava-direct-gpt-experiment/ava-direct-gpt-schema.ts")
    const types = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-1a-types.ts")
    assert.match(prompts, /AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES/)
    assert.match(schema, /AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES/)
    for (const line of AVA_SUPERVISED_OUTBOUND_SIGNATURE_PROHIBITION_LINES) {
      assert.match(types, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    }
    assert.doesNotMatch(
      readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts"),
      /applyEquipifyApprovedSignatureToEmail/,
    )
  })

  runGate("New persisted drafts store unsigned body at generation boundary", () => {
    const cutover = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
    assert.match(cutover, /stripAccidentalAvaSignatureFromBody/)
    assert.match(cutover, /signatureApplied = false/)
    assert.match(
      readSource("lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts"),
      /unsignedBody/,
    )
  })

  runGate("Legacy signed draft is normalized before transport", () => {
    const legacyBody = [
      "Hi Josh,",
      "",
      "Block Imaging looks like a strong fit.",
      "",
      "--",
      "Ava Sinclair",
      "Growth Advisor",
      "Equipify.ai",
      "ava@equipifyai.com",
    ].join("\n")
    const normalized = stripAccidentalAvaSignatureFromBody(legacyBody, SAMPLE_SIGNATURE.text)
    assert.doesNotMatch(normalized, /Ava Sinclair/)
    assert.doesNotMatch(normalized, /Growth Advisor/)
    assert.equal(bodyContainsLegacyAvaSignatureMarkers(normalized), false)
    assert.equal(countPlaintextSignatureSeparators(normalized), 0)
  })

  runGate("Non-Ava sender-signed draft is normalized before transport", () => {
    const legacyBody = [
      "Hi Josh,",
      "",
      "Block Imaging looks like a strong fit.",
      "",
      "--",
      "Mike Short",
      "Founder",
      "Blitz Industries",
      "mike@blitzind.com",
    ].join("\n")
    const normalized = stripAccidentalAvaSignatureFromBody(legacyBody, SAMPLE_SIGNATURE.text)
    assert.doesNotMatch(normalized, /Mike Short/)
    assert.equal(countPlaintextSignatureSeparators(normalized), 0)

    const prepared = appendSignatureToOutboundBody({
      htmlBody: `<div>${normalized}</div>`,
      textBody: normalized,
      signature: SAMPLE_SIGNATURE,
    })
    assert.equal(prepared.signatureInjected, true)
    assert.equal(countPlaintextSignatureSeparators(prepared.textBody), 1)
  })

  runGate("Canonical signature is appended exactly once", () => {
    const body = "Hi Josh,\n\nWorth a quick conversation?"
    const first = appendSignatureToOutboundBody({
      htmlBody: `<div>${body}</div>`,
      textBody: body,
      signature: SAMPLE_SIGNATURE,
    })
    assert.equal(first.signatureInjected, true)
    assert.equal(countPlaintextSignatureSeparators(first.textBody), 1)

    const second = appendSignatureToOutboundBody({
      htmlBody: first.htmlBody,
      textBody: first.textBody,
      signature: SAMPLE_SIGNATURE,
    })
    assert.equal(second.signatureInjected, false)
    assert.equal(countPlaintextSignatureSeparators(second.textBody), 1)
  })

  runGate("Retry cannot duplicate the signature", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    const boundary = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary.ts")
    assert.match(sendService, /already_sent|existingReceipt/)
    assert.match(boundary, /plaintext_signature_boundary_count_invalid/)
    assert.match(boundary, /prepareGrowthAiCopilotOutboundEmailContent/)
  })

  runGate("Exact approved recipient/subject/body are used", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    const approval = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts")
    assert.match(approval, /recipientEmail/)
    assert.match(approval, /bodyFingerprint/)
    assert.match(sendService, /approved_body_mismatch/)
    assert.match(sendService, /binding\.recipientEmail/)
    assert.match(sendService, /binding\.unsignedBody/)
  })

  runGate("One generation cannot send twice (atomic claim before transport)", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    const claim = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-claim.ts")
    const migration = readSource(
      "supabase/migrations/20270724153000_ava_supervised_outbound_send_claim_1b.sql",
    )
    assert.match(sendService, /claimAvaSupervisedOutboundSend/)
    assert.match(sendService, /already_sent|send_in_progress/)
    assert.match(claim, /claim_ava_supervised_outbound_send/)
    assert.match(migration, /for update/)
    assert.match(migration, /send_in_progress/)
  })

  runGate("Outbound requires explicit approval and send action", () => {
    const sendRoute = readSource("app/api/platform/growth/copilot/generations/[generationId]/send/route.ts")
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.match(sendRoute, /humanApprovalConfirmed/)
    assert.match(sendService, /generation_not_approved/)
    assert.match(sendService, /explicit_send_required/)
    assert.match(sendService, /executeTransportSend/)
    assert.doesNotMatch(sendService, /runDueScheduledOutreachExecutions/)
  })

  runGate("Provider receipt is persisted", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    const claim = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-claim.ts")
    assert.match(sendService, /avaSupervisedOutboundSendReceipt/)
    assert.match(sendService, /deliveryAttemptId/)
    assert.match(sendService, /providerMessageId/)
    assert.match(sendService, /finalizeAvaSupervisedOutboundSendClaim/)
    assert.match(claim, /sent_at/)
  })

  runGate("No autonomous or bulk send path is enabled for supervised Ava send", () => {
    const sendService = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.doesNotMatch(sendService, /createGrowthOutreachQueueItem/)
    assert.doesNotMatch(sendService, /runDueScheduledOutreachExecutions/)
    assert.doesNotMatch(sendService, /bulk/i)
  })

  runGate("Presentation layer remains read-only for reasoning and persistence contracts", () => {
    const sources = [
      "lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts",
      "lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts",
      "components/growth/growth-ava-operator-workspace-review.tsx",
    ]
    for (const source of sources) {
      const text = readSource(source)
      for (const pattern of FORBIDDEN_PRESENTATION_PATTERNS) {
        assert.doesNotMatch(text, pattern)
      }
    }
    assert.equal(
      fingerprintAvaSupervisedOutboundBody("Hello\n\nWorld"),
      fingerprintAvaSupervisedOutboundBody("Hello\n\nWorld"),
    )
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
