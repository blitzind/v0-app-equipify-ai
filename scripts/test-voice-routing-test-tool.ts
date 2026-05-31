/**
 * Voice routing test tool — admin UI + API contract checks.
 * Run: pnpm test:voice-routing-test-tool
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildRoutingTestRequestBody,
  initialRoutingTestVoiceNumberId,
  resolveRoutingTestVoiceNumberId,
} from "../lib/voice/admin/routing-test-form"

const voiceNumberId = "4a86ec58-9e83-4c09-b5aa-5efb1cf060b6"
const numbers = [{ id: voiceNumberId }]

assert.equal(resolveRoutingTestVoiceNumberId("", numbers), voiceNumberId)
assert.equal(resolveRoutingTestVoiceNumberId("  ", numbers), voiceNumberId)
assert.equal(resolveRoutingTestVoiceNumberId(voiceNumberId, []), voiceNumberId)
assert.equal(resolveRoutingTestVoiceNumberId("", []), "")
assert.equal(initialRoutingTestVoiceNumberId(numbers), voiceNumberId)

const body = buildRoutingTestRequestBody({
  voiceNumberId,
  fromNumber: "+14155550199",
})
assert.equal(body.voiceNumberId, voiceNumberId)
assert.equal(body.fromNumber, "+14155550199")
assert.equal(body.skipRoundRobinAdvance, true)

const routingTestRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/routing-test/route.ts"),
  "utf8",
)
assert.match(routingTestRoute, /voiceNumberId: z\.string\(\)\.uuid\(\)/)
assert.match(routingTestRoute, /previewInboundCallControlDecision/)
assert.match(routingTestRoute, /twimlPreview/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /resolveRoutingTestVoiceNumberId/)
assert.match(settingsPanel, /buildRoutingTestRequestBody/)
assert.match(settingsPanel, /initialRoutingTestVoiceNumberId/)
assert.match(settingsPanel, /routingTestLoading/)
assert.match(settingsPanel, /routingTestError/)
assert.match(settingsPanel, /RoutingTestResultPanel/)
assert.match(settingsPanel, /businessHoursStatus/)
assert.match(settingsPanel, /destinationUserIds/)
assert.match(settingsPanel, /dialClientIdentities/)
assert.match(settingsPanel, /twimlPreview/)
assert.match(settingsPanel, /voiceNumberId/)
assert.doesNotMatch(settingsPanel, /placeholder=\{numbers\[0\]\?\.id/)

console.log("voice-routing-test-tool checks passed")
