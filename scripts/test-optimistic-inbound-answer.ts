/**
 * Optimistic inbound answer — UI uses an active local session while server reconcile is authoritative.
 * Run: pnpm test:optimistic-inbound-answer
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildOptimisticActiveInboundSession,
  buildOptimisticInboundAnswerCoachTurn,
  OPTIMISTIC_INBOUND_ANSWER_QA_MARKER,
} from "../lib/growth/live-coaching/optimistic-inbound-answer"
import { resolveSayThisNext } from "../lib/growth/operator-assist/resolve-say-this-next"
import { resolveInboundWorkspacePhase } from "../lib/voice/browser-calling/browser-incoming-call"

const ringingSession = {
  id: "sess-1",
  leadId: null,
  ownerUserId: "user-1",
  provider: "twilio" as const,
  fallbackProvider: null,
  dialMode: "inbound" as const,
  direction: "inbound" as const,
  status: "ringing" as const,
  phoneNumber: "+14155550199",
  contactName: "Acme",
  companyName: "Acme",
  startedAt: "2026-05-29T12:00:00.000Z",
  connectedAt: null,
  endedAt: null,
  durationSeconds: 0,
  recordingState: "pending" as const,
  muted: false,
  onHold: false,
  transferTarget: null,
  notesDraft: "",
  realtimeSessionId: null,
  callCopilotSessionId: null,
  providerCallRef: null,
  safeSummary: "Ringing",
  voiceCallId: "vc-1",
}

const optimisticSession = buildOptimisticActiveInboundSession(ringingSession, "2026-05-29T12:00:05.000Z")
assert.equal(optimisticSession.status, "active")
assert.ok(optimisticSession.connectedAt)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: optimisticSession.status, sdkIncoming: false }),
  "active",
  "optimistic active session should enter active phase without waiting for server",
)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: "active", sdkIncoming: true }),
  "active",
  "active session must win over stale sdkIncoming flag",
)

const optimisticCoach = buildOptimisticInboundAnswerCoachTurn()
const sayThisNext = resolveSayThisNext(null, optimisticCoach)
assert.ok(sayThisNext)
assert.match(sayThisNext!.phrase, /prompted you to reach out/i)
assert.equal(sayThisNext!.qaMarker, "growth-live-coaching-v2-v1")
assert.equal(OPTIMISTIC_INBOUND_ANSWER_QA_MARKER, "growth-optimistic-inbound-answer-v1")

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(
  workspaceSource,
  /await reconcileInboundAnswer\(\{[\s\S]*sessionForAnswer: capturedSession[\s\S]*hadSdkIncoming: hasSdkIncoming[\s\S]*\}\)/,
  "answer flow must await server reconciliation after SDK accept",
)
assert.doesNotMatch(
  workspaceSource,
  /void voiceBrowser\.refresh\(\)\.catch\(\(\) => undefined\)[\s\S]{0,200}await reconcileInboundAnswer/,
  "answer flow must not refresh browser/operator assist state before answer reconciliation completes",
)
assert.match(
  workspaceSource,
  /applyServerSession\(answeredSession\)[\s\S]*void voiceBrowser\.refresh\(\)\.catch\(\(\) => undefined\)/,
  "answer reconciliation must apply the linked server session before refreshing operator assist",
)
assert.match(
  workspaceSource,
  /function isAuthoritativeLinkedAnswerResponse[\s\S]*input\.session\.status === "active" \|\| input\.session\.status === "on_hold"[\s\S]*Boolean\(input\.session\.realtimeSessionId\)[\s\S]*input\.pipeline\?\.liveCoachingLinked === true[\s\S]*Boolean\(input\.pipeline\.realtimeSessionId\)/,
  "client must recognize an active linked answer response as authoritative",
)
assert.match(
  workspaceSource,
  /const authoritativeLinkedAnswer = isAuthoritativeLinkedAnswerResponse\(\{[\s\S]*session: answeredSession[\s\S]*pipeline: data\.pipeline[\s\S]*\}\)/,
  "answer reconciliation must classify the returned server session before applying lifecycle locks",
)
assert.match(
  workspaceSource,
  /if \(responseLifecycleLocked && !authoritativeLinkedAnswer\)[\s\S]*reconcileInboundAnswer_skipped_response_lifecycle_locked[\s\S]*return/,
  "lifecycle locks may only skip non-authoritative answer responses",
)
assert.match(
  workspaceSource,
  /if \(authoritativeLinkedAnswer\) \{[\s\S]*clearLifecycleLocksForAnsweredSession\(answeredSession\)[\s\S]*phase: "active"[\s\S]*applyServerSession\(answeredSession\)/,
  "authoritative linked answer responses must clear stale locks, restore active authority, and apply the server session",
)
assert.doesNotMatch(
  workspaceSource,
  /if \(\s*isCallLifecycleEndedLocked\(\{[\s\S]*sessionId: data\.session\.id[\s\S]*return[\s\S]*\}\s*\)\s*\)\s*\{/,
  "answer response must not unconditionally return before applying an active linked server session",
)

console.log("optimistic-inbound-answer checks passed")
