/**
 * GS-GROWTH-SIGNATURES-1B — signature injection safeguards.
 * Run: pnpm test:growth-signature-injection-1b
 */
import assert from "node:assert/strict"
import {
  appendSignatureToOutboundBody,
  GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR,
  GROWTH_SIGNATURE_INJECTION_QA_MARKER,
  outboundBodyContainsSignature,
} from "../lib/growth/signatures/signature-injection"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"

const SAMPLE_SIGNATURE = renderSignatureTemplate("simple", {
  display_name: "Michael Short",
  title: "Founder",
  email: "mike@equipifyai.com",
  phone: "865-555-0100",
  website: "equipify.ai",
})

const UNSUB_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>'

function testInjectOnceOnly() {
  const baseHtml = `<div>Hello prospect</div>${UNSUB_FOOTER}`
  const baseText = "Hello prospect\n\nReply STOP to unsubscribe."

  const first = appendSignatureToOutboundBody({
    htmlBody: baseHtml,
    textBody: baseText,
    signature: SAMPLE_SIGNATURE,
  })
  assert.equal(first.signatureInjected, true)
  assert.ok(first.htmlBody.includes(GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR))

  const second = appendSignatureToOutboundBody({
    htmlBody: first.htmlBody,
    textBody: first.textBody,
    signature: SAMPLE_SIGNATURE,
  })
  assert.equal(second.signatureInjected, false)
  assert.equal(second.htmlBody, first.htmlBody)
}

function testFooterPlacementPreserved() {
  const baseHtml = `<div>Body copy</div>${UNSUB_FOOTER}`
  const result = appendSignatureToOutboundBody({
    htmlBody: baseHtml,
    textBody: "Body copy",
    signature: SAMPLE_SIGNATURE,
  })

  const footerIdx = result.htmlBody.indexOf("{{unsubscribe_link}}")
  const markerIdx = result.htmlBody.indexOf(GROWTH_OUTBOUND_SIGNATURE_MARKER_ATTR)
  assert.ok(markerIdx >= 0)
  assert.ok(footerIdx > markerIdx)
}

function testPlaintextUnsubscribePreserved() {
  const result = appendSignatureToOutboundBody({
    htmlBody: `<div>Hi</div>${UNSUB_FOOTER}`,
    textBody: "Hi\n\nReply STOP to unsubscribe.",
    signature: SAMPLE_SIGNATURE,
  })

  assert.match(result.textBody, /--\nMichael Short/)
  assert.match(result.textBody, /Reply STOP to unsubscribe/)
  const unsubIdx = result.textBody.indexOf("Reply STOP")
  const sigIdx = result.textBody.indexOf("--\nMichael")
  assert.ok(sigIdx < unsubIdx)
}

function testTrackingLikeHtmlPreserved() {
  const trackingPixel = '<img src="https://track.example/pixel.gif" width="1" height="1" alt="" />'
  const baseHtml = `<div>Tracked</div>${trackingPixel}${UNSUB_FOOTER}`
  const result = appendSignatureToOutboundBody({
    htmlBody: baseHtml,
    textBody: "Tracked",
    signature: SAMPLE_SIGNATURE,
  })

  assert.ok(result.htmlBody.includes(trackingPixel))
}

function testNullSignatureNoOp() {
  const baseHtml = `<div>Plain</div>${UNSUB_FOOTER}`
  const result = appendSignatureToOutboundBody({
    htmlBody: baseHtml,
    textBody: "Plain",
    signature: null,
  })
  assert.equal(result.signatureInjected, false)
  assert.equal(result.htmlBody, baseHtml)
}

function testContainsSignatureHelper() {
  const injected = appendSignatureToOutboundBody({
    htmlBody: "<div>x</div>",
    textBody: "x",
    signature: SAMPLE_SIGNATURE,
  })
  assert.equal(outboundBodyContainsSignature(injected.htmlBody, injected.textBody), true)
  assert.equal(outboundBodyContainsSignature("<div>x</div>", "x"), false)
}

function testQaMarker() {
  assert.equal(GROWTH_SIGNATURE_INJECTION_QA_MARKER, "growth-signature-injection-1b-v1")
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "inject once only", fn: testInjectOnceOnly },
  { name: "footer placement preserved", fn: testFooterPlacementPreserved },
  { name: "plaintext unsubscribe preserved", fn: testPlaintextUnsubscribePreserved },
  { name: "tracking html preserved", fn: testTrackingLikeHtmlPreserved },
  { name: "null signature no-op", fn: testNullSignatureNoOp },
  { name: "contains signature helper", fn: testContainsSignatureHelper },
  { name: "qa marker", fn: testQaMarker },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} growth-signature-injection-1b tests passed.`)
