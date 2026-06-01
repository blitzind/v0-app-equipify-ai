/**
 * Browser inbound answer timing — regression checks.
 * Run: pnpm test:voice-browser-incoming-answer-timing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildInboundRingingSessionFromOffer,
  buildInboundRingingSessionPlaceholder,
  resolveInboundWorkspacePhase,
  shouldShowInboundAnswerControls,
} from "../lib/voice/browser-calling/browser-incoming-call"
import { resolveInboundNativeSessionStatusFromVoiceCall } from "../lib/voice/browser-calling/status-mapping"

assert.equal(
  resolveInboundNativeSessionStatusFromVoiceCall({
    voiceStatus: "in_progress",
    direction: "inbound",
    answeredAt: null,
  }),
  "ringing",
  "inbound in_progress without answered_at should stay ringing",
)

assert.equal(
  resolveInboundNativeSessionStatusFromVoiceCall({
    voiceStatus: "in_progress",
    direction: "inbound",
    answeredAt: "2026-06-01T00:01:00.000Z",
  }),
  "active",
  "inbound in_progress with answered_at should become active",
)

assert.equal(
  resolveInboundNativeSessionStatusFromVoiceCall({
    voiceStatus: "in_progress",
    direction: "outbound",
    answeredAt: null,
  }),
  "active",
  "outbound in_progress should not be forced to ringing",
)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: null, sdkIncoming: true }),
  "incoming",
  "SDK incoming should set workspace phase before DB session exists",
)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: "ringing", sdkIncoming: false }),
  "incoming",
  "DB ringing session should still show incoming phase",
)

assert.equal(
  shouldShowInboundAnswerControls({ sdkIncoming: true, activeSessionStatus: null }),
  true,
  "Answer controls should be available from SDK state alone",
)

const placeholder = buildInboundRingingSessionPlaceholder({
  incomingCall: {
    callSid: "CA123",
    fromNumber: "+14155550199",
    toNumber: "+18333784743",
    receivedAt: "2026-06-01T00:00:00.000Z",
  },
})
assert.equal(placeholder.status, "ringing")
assert.equal(placeholder.direction, "inbound")
assert.equal(placeholder.phoneNumber, "+14155550199")
assert.match(placeholder.id, /^pending-inbound-/)

const offerSession = buildInboundRingingSessionFromOffer({
  voiceCallId: "vc-123",
  workspaceSessionId: "sess-456",
  fromNumber: "+14155550199",
  toNumber: "+18333784743",
  contactLabel: "Acme",
  offeredAt: "2026-06-01T00:00:00.000Z",
})
assert.equal(offerSession.id, "sess-456")
assert.equal(offerSession.voiceCallId, "vc-123")
assert.equal(offerSession.status, "ringing")
assert.equal(offerSession.contactName, "Acme")

const hookSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/voice/use-voice-browser-calling.ts"),
  "utf8",
)
assert.match(hookSource, /device\.on\("incoming"/)
assert.match(hookSource, /call\.accept\(/)
assert.match(hookSource, /incomingCall/)
assert.match(hookSource, /acceptIncomingCall/)
assert.match(hookSource, /onIncomingCleared/)
assert.match(hookSource, /sdk_incoming_received/)
assert.match(hookSource, /sdk_incoming_cancelled/)
assert.match(hookSource, /VOICE_BROWSER_RINGING_SYNC_INTERVAL_MS/)

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceSource, /acceptIncomingCall/)
assert.match(workspaceSource, /rejectIncomingCall/)
assert.match(workspaceSource, /resolveInboundWorkspacePhase/)
assert.match(workspaceSource, /buildInboundRingingSessionFromOffer/)
assert.match(workspaceSource, /buildInboundRingingSessionPlaceholder/)
assert.match(workspaceSource, /inbound_offer_received/)
assert.match(workspaceSource, /inbound_offer_rendered/)
assert.match(workspaceSource, /inbound_offer_cleared/)
assert.match(workspaceSource, /showIncomingDuringLoad/)
assert.doesNotMatch(
  workspaceSource,
  /refreshInboundOfferSession/,
  "inbound offer should hydrate from sync snapshot, not dashboard fetch",
)
assert.doesNotMatch(
  workspaceSource,
  /onInboundOffer[\s\S]{0,400}void load\(\)/,
  "inbound offer handler should not trigger full load()",
)

const workspaceBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
assert.match(workspaceBridge, /resolveInboundNativeSessionStatusFromVoiceCall/)
assert.match(workspaceBridge, /Boolean\(callRow\.answered_at\)/)

const coachingService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-service.ts"),
  "utf8",
)
assert.match(coachingService, /voiceCallRow\?\.answered_at/)

console.log("voice-browser-incoming-answer-timing checks passed")
