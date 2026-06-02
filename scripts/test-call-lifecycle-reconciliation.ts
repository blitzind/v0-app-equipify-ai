/**
 * Call lifecycle reconciliation — sync must not downgrade local accept/end state.
 * Run: pnpm test:call-lifecycle-reconciliation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { resolveInboundWorkspacePhase } from "../lib/voice/browser-calling/browser-incoming-call"
import {
  buildOptimisticWrappingSession,
  CALL_LIFECYCLE_RECONCILIATION_QA_MARKER,
  compareVoiceCallRecency,
  filterInboundOfferForLifecycle,
  isNativeSessionIdServerReady,
  mergeServerSessionIntoLocal,
  reconcileBrowserSyncInboundSelection,
  resolveWorkspaceSessionPinForBrowserSync,
  shouldApplyInboundOfferToSession,
  shouldHonorSdkIncomingForLifecycle,
  shouldSyncNativeSessionFromVoiceCall,
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
const endedSessionIds = new Set<string>()
const completedSessionIds = new Set<string>()

assert.equal(CALL_LIFECYCLE_RECONCILIATION_QA_MARKER, "call-lifecycle-reconciliation-v3")

assert.ok(
  compareVoiceCallRecency("2026-06-02T22:18:44.000Z", "2026-06-02T22:32:03.000Z") > 0,
)

assert.equal(
  reconcileBrowserSyncInboundSelection({
    activeVoiceCallId: "vc-old",
    workspaceSessionId: "sess-old",
    sessionStatusForSync: "ringing",
    activeVoiceCallCreatedAt: "2026-06-02T22:18:44.000Z",
    inboundOffer: {
      ...offer,
      voiceCallId: "vc-new",
      workspaceSessionId: "sess-new",
      voiceCallCreatedAt: "2026-06-02T22:32:03.000Z",
    },
    baseSelectionReason: "client_pinned_session",
    inboundSelectionReason: "newest_offerable_voice_call",
  }).selectionReason,
  "inbound_offer_supersedes_stale_pin",
)

assert.equal(
  shouldHonorSdkIncomingForLifecycle({
    sdkIncoming: true,
    voiceCallId: "vc-1",
    sessionId: "sess-1",
    locks: { endedVoiceCallIds: new Set(["vc-1"]), endedSessionIds: new Set(["sess-1"]), completedSessionIds: new Set(), completedVoiceCallIds: new Set() },
  }),
  false,
  "sdk incoming must be ignored after local end lock",
)

assert.equal(shouldSyncNativeSessionFromVoiceCall("wrapping"), false)
assert.equal(shouldSyncNativeSessionFromVoiceCall("active"), true)

const emptyLocks = {
  endedVoiceCallIds: new Set<string>(),
  endedSessionIds: new Set<string>(),
  completedSessionIds: new Set<string>(),
  completedVoiceCallIds: new Set<string>(),
}

assert.equal(
  resolveWorkspaceSessionPinForBrowserSync({
    authorityPhase: "active",
    activeSession,
    authoritySessionId: "sess-1",
    lastKnownSessionId: "sess-1",
    locks: emptyLocks,
  }),
  "sess-1",
  "live active call must pin workspace session",
)

assert.equal(
  resolveWorkspaceSessionPinForBrowserSync({
    authorityPhase: "active",
    activeSession: { ...activeSession, status: "wrapping", endedAt: "2026-05-29T12:05:00.000Z" },
    authoritySessionId: "sess-1",
    lastKnownSessionId: "sess-1",
    locks: emptyLocks,
  }),
  null,
  "wrapping session must not pin browser sync",
)

assert.equal(
  resolveWorkspaceSessionPinForBrowserSync({
    authorityPhase: "wrapup",
    activeSession: { ...activeSession, status: "wrapping", endedAt: "2026-05-29T12:05:00.000Z" },
    authoritySessionId: "sess-1",
    lastKnownSessionId: "sess-1",
    locks: emptyLocks,
  }),
  null,
  "wrapup authority must not pin browser sync",
)

assert.equal(
  resolveWorkspaceSessionPinForBrowserSync({
    authorityPhase: "active",
    activeSession,
    authoritySessionId: "sess-1",
    lastKnownSessionId: "sess-1",
    locks: { ...emptyLocks, endedSessionIds: new Set(["sess-1"]) },
  }),
  null,
  "ended lifecycle lock must not pin browser sync",
)

const workspaceBridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
assert.match(workspaceBridgeSource, /shouldSyncNativeSessionFromVoiceCall/)
assert.match(workspaceBridgeSource, /"wrapping", "completed"/)

const workspaceComponentSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceComponentSource, /callAuthority/)
assert.match(workspaceComponentSource, /applyServerSessionUnderAuthority/)
assert.match(workspaceComponentSource, /mapAuthorityToWorkspacePhase/)
assert.match(workspaceComponentSource, /resolveWorkspaceSessionPinForBrowserSync/)
assert.match(workspaceComponentSource, /sync_idle/)
assert.match(workspaceComponentSource, /applyServerSession/)
assert.match(workspaceComponentSource, /idleWorkspaceContextRef/)
assert.match(workspaceComponentSource, /isNativeSessionIdServerReady/)

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

const staleServerActive: NativeCallWorkspaceSessionPublicView = { ...activeSession }
const mergedAfterEnd = mergeServerSessionIntoLocal({
  local: wrappingSession,
  server: staleServerActive,
  acceptedSessionIds,
  endedVoiceCallIds: new Set(["vc-1"]),
  endedSessionIds: new Set(["sess-1"]),
})
assert.equal(mergedAfterEnd?.status, "wrapping", "merge must not resurrect active after local end")

const mergedAfterEndRinging = mergeServerSessionIntoLocal({
  local: wrappingSession,
  server: staleServerRinging,
  acceptedSessionIds,
  endedVoiceCallIds: new Set(["vc-1"]),
})
assert.equal(mergedAfterEndRinging?.status, "wrapping", "merge must not resurrect ringing after local end")

const rehydrateBlocked = mergeServerSessionIntoLocal({
  local: null,
  server: staleServerActive,
  acceptedSessionIds,
  endedVoiceCallIds: new Set(["vc-1"]),
  endedSessionIds: new Set(["sess-1"]),
})
assert.equal(rehydrateBlocked, null, "dashboard sync must not rehydrate ended active session")

const wrapupLoopBlocked = mergeServerSessionIntoLocal({
  local: null,
  server: wrappingSession,
  acceptedSessionIds,
  endedVoiceCallIds,
  endedSessionIds,
  completedSessionIds: new Set(["sess-1"]),
})
assert.equal(wrapupLoopBlocked, null, "completed wrap-up must not rehydrate wrapping session")

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

const schemaHealthSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/schema-health.ts"),
  "utf8",
)
assert.match(schemaHealthSource, /ready = missingTables\.length === 0/)
assert.match(schemaHealthSource, /ready = missingTables\.length === 0/)
assert.match(schemaHealthSource, /probeVoiceSchemaHealthCached/)
assert.match(schemaHealthSource, /probeVoiceSchemaHealthWithBudget/)

const inboundRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/inbound/twilio/route.ts"),
  "utf8",
)
assert.match(inboundRouteSource, /voice_inbound_webhook_failed/)
assert.match(inboundRouteSource, /fallbackInboundTwiml/)
assert.match(inboundRouteSource, /probeVoiceSchemaHealthWithBudget/)
assert.doesNotMatch(inboundRouteSource, /twimlResponse\(result\.twiml, result\.ok \? 200 : 404\)/)
assert.equal(isNativeSessionIdServerReady("pending-inbound-CA123"), false)
assert.equal(isNativeSessionIdServerReady("550e8400-e29b-41d4-a716-446655440000"), true)

const reconciliationSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/call-lifecycle-reconciliation.ts"),
  "utf8",
)
assert.match(reconciliationSource, /resolveAuthoritativeNativeSessionId/)

const wrapupRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/wrapup/route.ts"),
  "utf8",
)
assert.match(wrapupRouteSource, /fetchNativeCallWrapupBySessionId/)
assert.match(wrapupRouteSource, /requireGrowthNativeDialerSchemaReadyWithBudget/)

const endRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/end/route.ts"),
  "utf8",
)
assert.match(endRouteSource, /probeGrowthNativeDialerSchemaHealthWithBudget/)

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceSource, /wrapupConfirmedSessionIdsRef/)
assert.match(workspaceSource, /finalizeWrapupLocally/)
assert.match(workspaceSource, /scheduleCallsEndBackgroundRetry/)
assert.match(workspaceSource, /cancelCallsEndBackgroundRetry/)
assert.doesNotMatch(workspaceSource, /wrapupSubmittedSessionIdsRef/)

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
assert.match(repositorySource, /ensureNativeCallSessionReadyForWrapup/)
assert.match(repositorySource, /existingStatus === "wrapping"/)

console.log("call-lifecycle-reconciliation checks passed")
