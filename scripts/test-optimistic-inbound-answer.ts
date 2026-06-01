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
  /applyServerSession\(data\.session\)[\s\S]*void voiceBrowser\.refresh\(\)\.catch\(\(\) => undefined\)/,
  "answer reconciliation must apply the linked server session before refreshing operator assist",
)

console.log("optimistic-inbound-answer checks passed")
