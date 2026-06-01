/**
 * Call lifecycle reconciliation — sync must not downgrade local accept/end state.
 * Run: pnpm test:call-lifecycle-reconciliation
 */
import assert from "node:assert/strict"
import { resolveInboundWorkspacePhase } from "../lib/voice/browser-calling/browser-incoming-call"
import {
  buildOptimisticWrappingSession,
  CALL_LIFECYCLE_RECONCILIATION_QA_MARKER,
  filterInboundOfferForLifecycle,
  mergeServerSessionIntoLocal,
  shouldApplyInboundOfferToSession,
} from "../lib/voice/browser-calling/call-lifecycle-reconciliation"
import type { NativeCallWorkspaceSessionPublicView } from "../lib/growth/native-dialer/native-dialer-types"
import type { VoiceInboundBrowserOfferView } from "../lib/voice/browser-calling/types"

const offer: VoiceInboundBrowserOfferView = {
  voiceCallId: "vc-1",
  workspaceSessionId: "sess-1",
  fromNumber: "+14155550199",
  toNumber: "+14155550200",
  contactLabel: "Acme",
  offeredAt: "2026-05-29T12:00:00.000Z",
  voiceCallCreatedAt: "2026-05-29T12:00:00.000Z",
}

const ringingSession: NativeCallWorkspaceSessionPublicView = {
  id: "sess-1",
  leadId: null,
  ownerUserId: "user-1",
  provider: "twilio",
  fallbackProvider: null,
  dialMode: "inbound",
  direction: "inbound",
  status: "ringing",
  phoneNumber: offer.fromNumber,
  contactName: offer.contactLabel,
  companyName: "Incoming caller",
  startedAt: offer.offeredAt,
  connectedAt: null,
  endedAt: null,
  durationSeconds: 0,
  recordingState: "pending",
  muted: false,
  onHold: false,
  transferTarget: null,
  notesDraft: "",
  realtimeSessionId: null,
  callCopilotSessionId: null,
  providerCallRef: null,
  safeSummary: "Ringing",
  voiceCallId: offer.voiceCallId,
}

const activeSession: NativeCallWorkspaceSessionPublicView = {
  ...ringingSession,
  status: "active",
  connectedAt: "2026-05-29T12:00:05.000Z",
  safeSummary: "Live call",
}

const acceptedVoiceCallIds = new Set(["vc-1"])
const acceptedSessionIds = new Set(["sess-1"])
const endedVoiceCallIds = new Set<string>()

assert.equal(CALL_LIFECYCLE_RECONCILIATION_QA_MARKER, "call-lifecycle-reconciliation-v1")

assert.equal(
  shouldApplyInboundOfferToSession({
    offer,
    activeSession,
    acceptedVoiceCallIds,
    acceptedSessionIds,
    endedVoiceCallIds,
  }),
  false,
  "stale inbound offer must not apply after local accept",
)

assert.equal(
  filterInboundOfferForLifecycle({
    offer,
    activeSession,
    acceptedVoiceCallIds,
    acceptedSessionIds,
    endedVoiceCallIds,
  }),
  null,
  "filter must drop offer when session is locally active",
)

const staleServerRinging: NativeCallWorkspaceSessionPublicView = { ...ringingSession }
const mergedAfterAccept = mergeServerSessionIntoLocal({
  local: activeSession,
  server: staleServerRinging,
  acceptedSessionIds,
  endedVoiceCallIds,
})
assert.equal(mergedAfterAccept?.status, "active", "merge must not downgrade active to ringing")
assert.ok(mergedAfterAccept?.connectedAt, "merge must preserve connectedAt")

const wrappingSession = buildOptimisticWrappingSession(activeSession, "2026-05-29T12:05:00.000Z")
assert.equal(wrappingSession.status, "wrapping")
assert.ok(wrappingSession.endedAt)
assert.equal(wrappingSession.durationSeconds, 295)

const mergedAfterEnd = mergeServerSessionIntoLocal({
  local: wrappingSession,
  server: staleServerRinging,
  acceptedSessionIds,
  endedVoiceCallIds: new Set(["vc-1"]),
})
assert.equal(mergedAfterEnd?.status, "wrapping", "merge must not resurrect ringing after local end")

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: "active", sdkIncoming: true }),
  "active",
  "active session must win over stale sdkIncoming",
)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: "wrapping", sdkIncoming: true }),
  "wrapup",
  "wrapping session must win over stale sdkIncoming",
)

console.log("call-lifecycle-reconciliation checks passed")
