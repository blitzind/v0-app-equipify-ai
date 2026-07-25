/**
 * AVA-SIGNATURE-BOUNDARY-TRANSPORT-HOTFIX-1B — certification.
 * Run: pnpm test:ava-signature-boundary-transport-hotfix-1b
 */
import assert from "node:assert/strict"
import { renderSignatureTemplate } from "@/lib/growth/signatures/signature-template-render"
import { appendSignatureToOutboundBody } from "@/lib/growth/signatures/signature-injection"
import {
  AVA_SUPERVISED_OUTBOUND_PLAINTEXT_SIGNATURE_SEPARATOR_PATTERN,
  AVA_SUPERVISED_OUTBOUND_SIGNATURE_BOUNDARY_CORE_QA_MARKER,
  countHtmlBrSignatureSeparators,
  countHtmlSignatureMarkers,
  countPlaintextSignatureSeparators,
  normalizeOutboundPlaintextLineEndings,
  outboundUnsignedBodyRequiresReapproval,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { AvaSupervisedOutboundTransportPrepError } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary"

const SAMPLE_SIGNATURE = renderSignatureTemplate("simple", {
  display_name: "Ava Sinclair",
  title: "Growth Advisor",
  email: "ava@equipifyai.com",
  website: "equipify.ai",
})

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function main(): void {
  console.log(`[${AVA_SUPERVISED_OUTBOUND_SIGNATURE_BOUNDARY_CORE_QA_MARKER}] hotfix 1b certification`)

  runGate("normalizes CRLF line endings", () => {
    assert.equal(normalizeOutboundPlaintextLineEndings("a\r\nb\rc"), "a\nb\nc")
  })

  runGate("counts LF separator", () => {
    assert.equal(countPlaintextSignatureSeparators("Hi\n\n--\nSig"), 1)
  })

  runGate("counts CRLF separator", () => {
    assert.equal(countPlaintextSignatureSeparators("Hi\r\n\r\n--\r\nSig"), 1)
  })

  runGate("counts whitespace-padded separator", () => {
    assert.equal(countPlaintextSignatureSeparators("Hi\n  --  \nSig"), 1)
  })

  runGate("does not count internal inline dashes", () => {
    assert.equal(countPlaintextSignatureSeparators("Use option A -- option B in the same line."), 0)
  })

  runGate("strips CRLF trailing signature block", () => {
    const body = ["Hi Mike,", "", "Certification body.", "", "--", "Mike Short", "Founder"].join("\r\n")
    const normalized = stripAccidentalAvaSignatureFromBody(body, SAMPLE_SIGNATURE.text)
    assert.equal(countPlaintextSignatureSeparators(normalized), 0)
    assert.doesNotMatch(normalized, /Mike Short/)
  })

  runGate("strips whitespace-padded trailing signature block", () => {
    const body = "Hi Mike,\n\n  --  \nMike Short\nFounder"
    const normalized = stripAccidentalAvaSignatureFromBody(body, SAMPLE_SIGNATURE.text)
    assert.equal(countPlaintextSignatureSeparators(normalized), 0)
  })

  runGate("strips HTML br separator tail", () => {
    const html = "<div>Hi Mike,<br/><br/>--<br/>Mike Short<br/>Founder</div>"
    const normalized = stripAccidentalAvaSignatureFromBody(html, SAMPLE_SIGNATURE.text)
    assert.equal(countHtmlBrSignatureSeparators(normalized), 0)
  })

  runGate("strips canonical HTML signature marker tail", () => {
    const html =
      '<div>Body</div><div data-growth-outbound-signature="1b"><p>Ava Sinclair</p></div>'
    const normalized = stripAccidentalAvaSignatureFromBody(html, SAMPLE_SIGNATURE.text)
    assert.equal(countHtmlSignatureMarkers(normalized), 0)
  })

  runGate("requires reapproval for pre-hotfix signed bundle", () => {
    const signed = "Hi Josh,\n\nBody\n\n--\nMike Short\nFounder"
    assert.equal(
      outboundUnsignedBodyRequiresReapproval({
        approvedUnsignedBody: signed,
        canonicalSignatureText: SAMPLE_SIGNATURE.text,
      }),
      true,
    )
  })

  runGate("clean unsigned body does not require reapproval", () => {
    const clean = "Hi Mike,\n\nCertification body."
    assert.equal(
      outboundUnsignedBodyRequiresReapproval({
        approvedUnsignedBody: clean,
        canonicalSignatureText: SAMPLE_SIGNATURE.text,
      }),
      false,
    )
  })

  runGate("append yields exactly one LF boundary", () => {
    const body = "Hi Mike,\n\nCertification body."
    const prepared = appendSignatureToOutboundBody({
      htmlBody: `<div>${body}</div>`,
      textBody: body,
      signature: SAMPLE_SIGNATURE,
    })
    assert.equal(prepared.signatureInjected, true)
    assert.equal(countPlaintextSignatureSeparators(prepared.textBody), 1)
    assert.equal(countHtmlSignatureMarkers(prepared.htmlBody), 1)
  })

  runGate("structured transport prep error exposes code", () => {
    const error = new AvaSupervisedOutboundTransportPrepError(
      "plaintext_signature_boundary_count_invalid",
      "Prepared outbound body has more than one plaintext signature boundary.",
    )
    assert.equal(error.code, "plaintext_signature_boundary_count_invalid")
  })

  runGate("separator regex matches documented shape", () => {
    assert.equal(countPlaintextSignatureSeparators("\n--\nx"), 1)
    assert.equal(countPlaintextSignatureSeparators("\n  --  \nx"), 1)
  })

  console.log(`[${AVA_SUPERVISED_OUTBOUND_SIGNATURE_BOUNDARY_CORE_QA_MARKER}] PASS`)
}

main()
