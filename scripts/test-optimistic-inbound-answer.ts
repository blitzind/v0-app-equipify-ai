/**
 * Optimistic inbound answer — UI must not block on server reconcile.
 * Run: pnpm test:optimistic-inbound-answer
 */
import assert from "node:assert/strict"
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

const optimisticCoach = buildOptimisticInboundAnswerCoachTurn()
const sayThisNext = resolveSayThisNext(null, optimisticCoach)
assert.ok(sayThisNext)
assert.match(sayThisNext!.phrase, /prompted you to reach out/i)
assert.equal(sayThisNext!.qaMarker, "growth-live-coaching-v2-v1")
assert.equal(OPTIMISTIC_INBOUND_ANSWER_QA_MARKER, "growth-optimistic-inbound-answer-v1")

console.log("optimistic-inbound-answer checks passed")
