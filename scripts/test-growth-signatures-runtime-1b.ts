/**
 * GS-GROWTH-SIGNATURES-1B — outbound signature runtime wiring tests.
 * Run: pnpm test:growth-signatures-runtime-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testRuntimeModule() {
  const runtime = readSource("lib/growth/signatures/outbound-signature-runtime.ts")
  assert.match(runtime, /prepareOutboundEmailContent/)
  assert.match(runtime, /resolveOutboundSignatureForSender/)
  assert.match(runtime, /applySenderMergeFieldsToText/)
  assert.match(runtime, /appendSignatureToOutboundBody/)
  assert.match(runtime, /growth-outbound-signature-runtime-1b-v1/)
}

function testSequenceSendBuilderWired() {
  const source = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(source, /prepareOutboundEmailContent/)
  assert.match(source, /applyOutboundEmailTracking/)
  const prepareIdx = source.indexOf("prepareOutboundEmailContent(admin")
  const trackingIdx = source.indexOf("applyOutboundEmailTracking({")
  assert.ok(prepareIdx >= 0 && trackingIdx > prepareIdx)
}

function testReplySendBuilderWired() {
  const source = readSource("lib/growth/replies/reply-send-builder.ts")
  assert.match(source, /prepareOutboundEmailContent/)
}

function testProviderTestSendWired() {
  const source = readSource("lib/growth/provider-setup/provider-test-send.ts")
  assert.match(source, /prepareOutboundEmailContent/)
  assert.match(source, /prepared\.htmlBody/)
  assert.match(source, /prepared\.textBody/)
}

function testApiTestSendWired() {
  const source = readSource("app/api/platform/growth/providers/test-send/route.ts")
  assert.match(source, /prepareOutboundEmailContent/)
}

function testAiCopilotOutboundWired() {
  const source = readSource("lib/growth/run-ai-copilot-generation.ts")
  assert.match(source, /prepareGrowthAiCopilotOutboundEmailContent/)
  assert.match(source, /prepareOutboundEmailContent/)
}

function testResolverMailboxFallback() {
  const resolver = readSource("lib/growth/signatures/signature-resolver.ts")
  assert.match(resolver, /getSenderProfileByMailboxConnectionId/)
  assert.match(resolver, /mailbox_profile/)
  assert.match(resolver, /sender_account_fallback/)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "outbound signature runtime module", fn: testRuntimeModule },
  { name: "sequence send builder wired", fn: testSequenceSendBuilderWired },
  { name: "reply send builder wired", fn: testReplySendBuilderWired },
  { name: "provider test send wired", fn: testProviderTestSendWired },
  { name: "API test send wired", fn: testApiTestSendWired },
  { name: "AI copilot outbound wired", fn: testAiCopilotOutboundWired },
  { name: "resolver mailbox fallback", fn: testResolverMailboxFallback },
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
console.log(`\nAll ${tests.length} growth-signatures-runtime-1b tests passed.`)
