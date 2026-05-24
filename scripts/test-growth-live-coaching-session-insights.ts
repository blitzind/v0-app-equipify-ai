/**
 * Regression checks for Growth Engine Live Coaching session insights rollup (slice 6.13B).
 * Run: pnpm test:growth-live-coaching-session-insights
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildLiveCoachingSessionInsightsRollup,
  toLiveCoachingSessionInsightsPreview,
} from "../lib/growth/realtime/live-coaching/session-insights-rollup"
import { computeSessionInsightsRiskLevel } from "../lib/growth/realtime/live-coaching/session-insights-risk-level"
import {
  buildLiveCoachingSessionInsightsQaProofMarker,
  LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER,
} from "../lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { buildDeterministicSessionTimelineEventId } from "../lib/growth/realtime/live-coaching/session-timeline-event-id"
import { sanitizeSessionTimelineDetail } from "../lib/growth/realtime/live-coaching/session-timeline-detail-safety"
import type { LiveCoachingSessionTimelineEvent } from "../lib/growth/realtime/live-coaching/session-timeline-types"

const sessionId = "22222222-2222-4222-8222-222222222222"
const leadId = "33333333-3333-4333-8333-333333333333"

function timelineEvent(
  overrides: Partial<LiveCoachingSessionTimelineEvent> = {},
): LiveCoachingSessionTimelineEvent {
  const eventType = overrides.eventType ?? "session_started"
  const sequenceNumber = overrides.sequenceNumber ?? 0
  return {
    id: buildDeterministicSessionTimelineEventId({ sessionId, sequenceNumber, eventType }),
    leadId,
    sessionId,
    sequenceNumber,
    eventType,
    severity: overrides.severity ?? "info",
    providerId: overrides.providerId ?? "deepgram",
    detail: overrides.detail ?? {},
    createdAt: overrides.createdAt ?? "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

const events: LiveCoachingSessionTimelineEvent[] = [
  timelineEvent({ sequenceNumber: 0, eventType: "session_started", createdAt: "2026-05-18T12:00:00.000Z" }),
  timelineEvent({
    sequenceNumber: 1,
    eventType: "provider_connected",
    providerId: "deepgram",
    createdAt: "2026-05-18T12:00:05.000Z",
  }),
  timelineEvent({
    sequenceNumber: 2,
    eventType: "transcript_finalized",
    detail: { latencyMs: 120, sequenceNumber: 1 },
    createdAt: "2026-05-18T12:00:10.000Z",
  }),
  timelineEvent({
    sequenceNumber: 3,
    eventType: "transcript_finalized",
    detail: { latencyMs: 180, sequenceNumber: 2 },
    createdAt: "2026-05-18T12:00:15.000Z",
  }),
  timelineEvent({
    sequenceNumber: 4,
    eventType: "guidance_generated",
    detail: { guidanceType: "objection_guidance", guidanceId: "abc" },
    createdAt: "2026-05-18T12:00:16.000Z",
  }),
  timelineEvent({
    sequenceNumber: 5,
    eventType: "objection_detected",
    detail: { signalKey: "pricing" },
    createdAt: "2026-05-18T12:00:17.000Z",
  }),
  timelineEvent({
    sequenceNumber: 6,
    eventType: "buying_signal_detected",
    detail: { signalKey: "timeline_urgency" },
    createdAt: "2026-05-18T12:00:18.000Z",
  }),
  timelineEvent({
    sequenceNumber: 7,
    eventType: "provider_disconnected",
    severity: "warning",
    createdAt: "2026-05-18T12:00:20.000Z",
  }),
  timelineEvent({
    sequenceNumber: 8,
    eventType: "provider_retry",
    severity: "warning",
    createdAt: "2026-05-18T12:00:25.000Z",
  }),
  timelineEvent({
    sequenceNumber: 9,
    eventType: "session_completed",
    detail: { durationMs: 300000 },
    createdAt: "2026-05-18T12:05:00.000Z",
  }),
]

const rollupA = buildLiveCoachingSessionInsightsRollup({ leadId, sessionId, events })
const rollupB = buildLiveCoachingSessionInsightsRollup({ leadId, sessionId, events })

assert.deepEqual(rollupA, rollupB, "rollup calculation is deterministic")
assert.equal(rollupA.providerId, "deepgram")
assert.equal(rollupA.transcriptFinalizedCount, 2)
assert.equal(rollupA.guidanceGeneratedCount, 1)
assert.equal(rollupA.objectionCount, 1)
assert.equal(rollupA.buyingSignalCount, 1)
assert.equal(rollupA.providerInterruptions, 1)
assert.equal(rollupA.retryAttempts, 1)
assert.equal(rollupA.averageTranscriptLatencyMs, 150)
assert.equal(rollupA.maxTranscriptLatencyMs, 180)
assert.equal(rollupA.sessionDurationMs, 300000)
assert.ok(rollupA.sessionHealthScore > 0 && rollupA.sessionHealthScore <= 100)

assert.equal(
  computeSessionInsightsRiskLevel({
    sessionHealthScore: 95,
    providerInterruptions: 0,
    retryAttempts: 0,
    fallbackCount: 0,
    circuitBreakerTriggered: false,
    objectionCount: 0,
    competitorPressureCount: 0,
    providerDegradedCount: 0,
  }),
  "low",
)

assert.equal(
  computeSessionInsightsRiskLevel({
    sessionHealthScore: 30,
    providerInterruptions: 4,
    retryAttempts: 3,
    fallbackCount: 2,
    circuitBreakerTriggered: true,
    objectionCount: 5,
    competitorPressureCount: 2,
    providerDegradedCount: 2,
  }),
  "critical",
)

const preview = toLiveCoachingSessionInsightsPreview(rollupA)
assert.equal(preview.sessionHealthScore, rollupA.sessionHealthScore)
assert.equal(preview.transcriptFinalizedCount, 2)

const proof = buildLiveCoachingSessionInsightsQaProofMarker({ hasRollup: true })
assert.equal(proof.marker, LIVE_COACHING_SESSION_INSIGHTS_QA_PROOF_MARKER)

const sanitized = sanitizeSessionTimelineDetail({
  latencyMs: 120,
  content: "should not persist",
  audioBase64: "blocked",
})
assert.equal("content" in sanitized, false)
assert.equal("audioBase64" in sanitized, false)

const insightsRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/insights/route.ts",
  ),
  "utf8",
)
const recomputeRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/insights/recompute/route.ts",
  ),
  "utf8",
)
const insightsUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-live-coaching-session-insights.tsx"),
  "utf8",
)

assert.match(insightsRoute, /requireGrowthEnginePlatformAccess/, "insights GET is platform-admin gated")
assert.match(recomputeRoute, /requireGrowthEnginePlatformAccess/, "insights recompute is platform-admin gated")
assert.match(insightsUi, /Recompute insights/, "insights UI exposes recompute action")
assert.match(insightsUi, /No timeline metrics yet/, "insights UI has empty state")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270219120000_growth_engine_session_insights.sql"),
  "utf8",
)
assert.match(migrationSource, /session_id uuid primary key/)
assert.match(migrationSource, /grant select, insert, update on table/)

console.log("growth-live-coaching-session-insights: all checks passed")
