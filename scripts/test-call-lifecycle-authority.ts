/**
 * Call lifecycle authority — SDK/local phase wins over server sync.
 * Run: pnpm test:call-lifecycle-authority
 */
import assert from "node:assert/strict"
import {
  applyServerSessionUnderAuthority,
  CALL_LIFECYCLE_AUTHORITY_QA_MARKER,
  createInitialCallLifecycleAuthority,
  mapAuthorityToWorkspacePhase,
  shouldClearSessionOnIncomingCleared,
  shouldHydrateInboundOfferUnderAuthority,
  transitionCallLifecycleAuthority,
} from "../lib/voice/browser-calling/call-lifecycle-authority"
import type { NativeCallWorkspaceSessionPublicView } from "../lib/growth/native-dialer/native-dialer-types"

const baseSession: NativeCallWorkspaceSessionPublicView = {
  id: "sess-1",
  leadId: null,
  ownerUserId: "user-1",
  provider: "twilio",
  fallbackProvider: null,
  dialMode: "inbound",
  direction: "inbound",
  status: "active",
  phoneNumber: "+14155550199",
  contactName: "Acme",
  companyName: "Acme Inc",
  startedAt: "2026-05-29T12:00:00.000Z",
  connectedAt: "2026-05-29T12:00:05.000Z",
  endedAt: null,
  durationSeconds: 12,
  recordingState: "pending",
  muted: false,
  onHold: false,
  transferTarget: null,
  notesDraft: "",
  realtimeSessionId: null,
  callCopilotSessionId: null,
  providerCallRef: null,
  safeSummary: "Live call",
  voiceCallId: "vc-1",
}

assert.equal(CALL_LIFECYCLE_AUTHORITY_QA_MARKER, "call-lifecycle-authority-v1")

// State machine transitions
let authority = createInitialCallLifecycleAuthority()
authority = transitionCallLifecycleAuthority(authority, { type: "sdk_incoming", callSid: "CA123" })
assert.equal(authority.phase, "incoming")
authority = transitionCallLifecycleAuthority(authority, { type: "sdk_accept_started" })
assert.equal(authority.phase, "accepting")
authority = transitionCallLifecycleAuthority(authority, {
  type: "sdk_accept_succeeded",
  connectedAt: "2026-05-29T12:00:05.000Z",
})
assert.equal(authority.phase, "active")
assert.equal(authority.connectedAt, "2026-05-29T12:00:05.000Z")

// Server ringing must not downgrade active authority
const serverRinging: NativeCallWorkspaceSessionPublicView = { ...baseSession, status: "ringing" }
const mergedWhileActive = applyServerSessionUnderAuthority({
  local: baseSession,
  server: serverRinging,
  authority,
  acceptedSessionIds: new Set(["sess-1"]),
  endedVoiceCallIds: new Set(),
})
assert.equal(mergedWhileActive?.status, "active")
assert.equal(mergedWhileActive?.contactName, "Acme")

// Server idle/null must not clear while authority active
const mergedWhileActiveNoServer = applyServerSessionUnderAuthority({
  local: baseSession,
  server: null,
  authority,
  acceptedSessionIds: new Set(["sess-1"]),
  endedVoiceCallIds: new Set(),
})
assert.equal(mergedWhileActiveNoServer?.status, "active")

// Local end → wrapup; server active must not resurrect
authority = transitionCallLifecycleAuthority(authority, {
  type: "local_end_requested",
  endedAt: "2026-05-29T12:01:00.000Z",
  voiceCallId: "vc-1",
  sessionId: "sess-1",
})
assert.equal(authority.phase, "ending")
const serverStillActive: NativeCallWorkspaceSessionPublicView = {
  ...baseSession,
  status: "active",
  durationSeconds: 55,
}
const mergedWhileEnding = applyServerSessionUnderAuthority({
  local: { ...baseSession, status: "wrapping", endedAt: "2026-05-29T12:01:00.000Z" },
  server: serverStillActive,
  authority,
  acceptedSessionIds: new Set(["sess-1"]),
  endedVoiceCallIds: new Set(["vc-1"]),
  endedSessionIds: new Set(["sess-1"]),
})
assert.equal(mergedWhileEnding?.status, "wrapping")

// SDK disconnect from active → wrapup with frozen duration
authority = transitionCallLifecycleAuthority(createInitialCallLifecycleAuthority(), {
  type: "sdk_accept_succeeded",
  connectedAt: "2026-05-29T12:00:00.000Z",
})
authority = transitionCallLifecycleAuthority(authority, { type: "sdk_disconnected", reason: "disconnect" })
assert.equal(authority.phase, "wrapup")
assert.ok(authority.frozenDurationSeconds != null)

// After wrapup confirmed → idle
authority = transitionCallLifecycleAuthority(authority, { type: "wrapup_confirmed" })
assert.equal(authority.phase, "idle")

// Server active after terminal must not resurrect (via mergeServerSessionIntoLocal path)
const resurrectAttempt = applyServerSessionUnderAuthority({
  local: null,
  server: serverStillActive,
  authority,
  acceptedSessionIds: new Set(),
  endedVoiceCallIds: new Set(["vc-1"]),
  endedSessionIds: new Set(["sess-1"]),
  completedSessionIds: new Set(["sess-1"]),
})
assert.equal(resurrectAttempt, null)

// Hydration guards
assert.equal(
  shouldHydrateInboundOfferUnderAuthority({
    authority: { ...createInitialCallLifecycleAuthority(), phase: "active" },
    hasLiveSdkCall: true,
  }),
  false,
)
assert.equal(
  shouldClearSessionOnIncomingCleared({
    authority: { ...createInitialCallLifecycleAuthority(), phase: "active" },
    hasLiveSdkCall: true,
    reason: "cancel",
  }),
  false,
)

// Workspace phase mapping
assert.equal(
  mapAuthorityToWorkspacePhase({
    authority: { ...createInitialCallLifecycleAuthority(), phase: "active" },
  }),
  "active",
)
assert.equal(
  mapAuthorityToWorkspacePhase({
    authority: { ...createInitialCallLifecycleAuthority(), phase: "wrapup" },
  }),
  "wrapup",
)

console.log("test-call-lifecycle-authority: all assertions passed")
