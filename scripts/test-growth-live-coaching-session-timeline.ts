/**
 * Regression checks for Growth Engine Live Coaching session timeline (slice 6.13A).
 * Run: pnpm test:growth-live-coaching-session-timeline
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDeterministicSessionTimelineEventId } from "../lib/growth/realtime/live-coaching/session-timeline-event-id"
import {
  assertSessionTimelineDetailSafe,
  sanitizeSessionTimelineDetail,
  SESSION_TIMELINE_FORBIDDEN_PERSISTENCE_KEYS,
} from "../lib/growth/realtime/live-coaching/session-timeline-detail-safety"
import {
  buildSessionTimelineDiagnostics,
  filterSessionTimelineEvents,
} from "../lib/growth/realtime/live-coaching/session-timeline-diagnostics"
import { computeSessionTimelineHealthScore } from "../lib/growth/realtime/live-coaching/session-timeline-health-score"
import {
  buildLiveCoachingSessionTimelineQaProofMarker,
  LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER,
} from "../lib/growth/realtime/live-coaching/live-coaching-production-proof"
import type { LiveCoachingSessionTimelineEvent } from "../lib/growth/realtime/live-coaching/session-timeline-types"

const sessionId = "22222222-2222-4222-8222-222222222222"
const leadId = "33333333-3333-4333-8333-333333333333"

function timelineEvent(
  overrides: Partial<LiveCoachingSessionTimelineEvent> = {},
): LiveCoachingSessionTimelineEvent {
  return {
    id: buildDeterministicSessionTimelineEventId({
      sessionId,
      sequenceNumber: overrides.sequenceNumber ?? 0,
      eventType: overrides.eventType ?? "session_started",
    }),
    leadId,
    sessionId,
    sequenceNumber: overrides.sequenceNumber ?? 0,
    eventType: overrides.eventType ?? "session_started",
    severity: overrides.severity ?? "info",
    providerId: overrides.providerId ?? "deepgram",
    detail: overrides.detail ?? {},
    createdAt: overrides.createdAt ?? "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

const idA = buildDeterministicSessionTimelineEventId({
  sessionId,
  sequenceNumber: 1,
  eventType: "provider_connected",
})
const idB = buildDeterministicSessionTimelineEventId({
  sessionId,
  sequenceNumber: 1,
  eventType: "provider_connected",
})
assert.equal(idA, idB)

const idC = buildDeterministicSessionTimelineEventId({
  sessionId,
  sequenceNumber: 2,
  eventType: "provider_connected",
})
assert.notEqual(idA, idC)

const sanitized = sanitizeSessionTimelineDetail({
  signalKey: "timeline_urgency",
  latencyMs: 142.7,
  content: "secret transcript text",
  audioBase64: "abc",
})
assert.equal(sanitized.signalKey, "timeline_urgency")
assert.equal(sanitized.latencyMs, 142.7)
assert.equal("content" in sanitized, false)
assert.equal("audioBase64" in sanitized, false)
assertSessionTimelineDetailSafe(sanitized)

for (const key of SESSION_TIMELINE_FORBIDDEN_PERSISTENCE_KEYS) {
  assert.throws(
    () => assertSessionTimelineDetailSafe({ [key]: "blocked" } as never),
    new RegExp(`session_timeline_detail_blocked_key:${key}`),
  )
}

const events: LiveCoachingSessionTimelineEvent[] = [
  timelineEvent({ sequenceNumber: 0, eventType: "session_started", createdAt: "2026-05-18T12:00:00.000Z" }),
  timelineEvent({
    sequenceNumber: 1,
    eventType: "transcript_finalized",
    detail: { latencyMs: 120 },
    createdAt: "2026-05-18T12:00:05.000Z",
  }),
  timelineEvent({
    sequenceNumber: 2,
    eventType: "provider_disconnected",
    severity: "warning",
    createdAt: "2026-05-18T12:00:10.000Z",
  }),
  timelineEvent({
    sequenceNumber: 3,
    eventType: "provider_retry",
    severity: "warning",
    createdAt: "2026-05-18T12:00:15.000Z",
  }),
  timelineEvent({
    sequenceNumber: 4,
    eventType: "provider_degraded",
    severity: "warning",
    createdAt: "2026-05-18T12:00:20.000Z",
  }),
]

assert.equal(events[0]!.sequenceNumber < events[1]!.sequenceNumber, true)
assert.equal(
  events.every((event, index) => index === 0 || event.sequenceNumber >= events[index - 1]!.sequenceNumber),
  true,
)

const diagnostics = buildSessionTimelineDiagnostics(events)
assert.equal(diagnostics.providerInterruptions, 1)
assert.equal(diagnostics.retryCount, 1)
assert.equal(diagnostics.transcriptLatencyTrend.length, 1)
assert.equal(diagnostics.transcriptLatencyTrend[0]!.latencyMs, 120)

const healthyScore = computeSessionTimelineHealthScore({
  providerInterruptions: 0,
  averageTranscriptLatencyMs: 100,
  reconnectCount: 0,
  retryCount: 0,
  providerDegradedEvents: 0,
})
assert.equal(healthyScore, 100)

const degradedScore = computeSessionTimelineHealthScore({
  providerInterruptions: 3,
  averageTranscriptLatencyMs: 300,
  reconnectCount: 2,
  retryCount: 2,
  providerDegradedEvents: 2,
})
assert.ok(degradedScore < healthyScore)

const filtered = filterSessionTimelineEvents(events, {
  providerId: "deepgram",
  severity: "warning",
  eventType: "provider_retry",
})
assert.equal(filtered.length, 1)
assert.equal(filtered[0]?.eventType, "provider_retry")

const proof = buildLiveCoachingSessionTimelineQaProofMarker({ eventCount: 5 })
assert.equal(proof.marker, LIVE_COACHING_SESSION_TIMELINE_QA_PROOF_MARKER)
assert.equal(proof.verified, true)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270218120000_growth_engine_session_timeline.sql"),
  "utf8",
)
assert.match(migrationSource, /grant select, insert on table/, "append-only DB grants")

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/live-coaching/session-timeline-repository.ts"),
  "utf8",
)
assert.match(repositorySource, /\.insert\(/, "repository supports append-only inserts")
assert.doesNotMatch(repositorySource, /\.update\s*\(/, "repository avoids update operations")
assert.doesNotMatch(repositorySource, /\.delete\s*\(/, "repository avoids delete operations")

const timelineComponentSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-live-coaching-session-timeline.tsx"),
  "utf8",
)
assert.match(timelineComponentSource, /filterSessionTimelineEvents/, "timeline UI supports filters")
assert.match(timelineComponentSource, /Session health/, "timeline UI renders diagnostics")
assert.match(timelineComponentSource, /qaProof/, "timeline UI renders QA proof marker")

console.log("growth-live-coaching-session-timeline: all checks passed")
