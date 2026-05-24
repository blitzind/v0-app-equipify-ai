/**
 * Regression checks for Growth Engine Live Coaching production hardening (slice 6.14A).
 * Run: pnpm test:growth-live-coaching-production-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildLiveCoachingCleanupQaProofMarker,
  buildLiveCoachingDashboardQaProofMarker,
  buildLiveCoachingSessionTimelineQaProofMarker,
  buildLiveCoachingTrendsQaProofMarker,
  LIVE_COACHING_CLEANUP_QA_PROOF_MARKER,
  LIVE_COACHING_DASHBOARD_QA_PROOF_MARKER,
  LIVE_COACHING_QA_PROOF_VERSION,
} from "../lib/growth/realtime/live-coaching/live-coaching-production-proof"

assert.equal(LIVE_COACHING_QA_PROOF_VERSION, "6.14A")

const emptyTimelineProof = buildLiveCoachingSessionTimelineQaProofMarker({ eventCount: 0 })
assert.equal(emptyTimelineProof.verified, false)
const timelineProof = buildLiveCoachingSessionTimelineQaProofMarker({ eventCount: 3 })
assert.equal(timelineProof.verified, true)

const dashboardProof = buildLiveCoachingDashboardQaProofMarker({ completedSessions: 2 })
assert.equal(dashboardProof.marker, LIVE_COACHING_DASHBOARD_QA_PROOF_MARKER)
assert.equal(dashboardProof.verified, true)

const cleanupProof = buildLiveCoachingCleanupQaProofMarker({
  staleStreamsClosed: 1,
  orphanSessionsDetached: 0,
  stuckStreamsDetected: 1,
})
assert.equal(cleanupProof.marker, LIVE_COACHING_CLEANUP_QA_PROOF_MARKER)

const trendsTruncated = buildLiveCoachingTrendsQaProofMarker({ sessionCount: 100, truncated: true })
assert.equal(trendsTruncated.verified, false)

const sessionMemorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/live-coaching/live-coaching-session-memory.ts"),
  "utf8",
)
assert.match(sessionMemorySource, /clearBrowserAudioStreamState/)
assert.match(sessionMemorySource, /clearBrowserAudioCaptureMetrics/)
assert.match(sessionMemorySource, /clearBrowserAudioChunkSequence/)
assert.match(sessionMemorySource, /clearRealtimeProviderStreamState/)

const providerSessionManagerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/provider-session-manager.ts"),
  "utf8",
)
assert.match(providerSessionManagerSource, /clearLiveCoachingSessionMemory/)

const routesToGate = [
  "app/api/platform/growth/calls/live-coaching/dashboard/route.ts",
  "app/api/platform/growth/calls/live-coaching/trends/route.ts",
  "app/api/platform/growth/realtime/providers/operations/cleanup/route.ts",
  "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/timeline/route.ts",
  "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/insights/route.ts",
  "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/insights/recompute/route.ts",
  "app/api/platform/growth/leads/[leadId]/realtime-call/sessions/[sessionId]/browser-audio-capture/route.ts",
]

for (const routePath of routesToGate) {
  const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf8")
  assert.match(source, /requireGrowthEnginePlatformAccess/, `${routePath} is platform-admin gated`)
  assert.match(source, /export const runtime = "nodejs"/, `${routePath} uses nodejs runtime`)
}

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270220120000_growth_engine_production_hardening_indexes.sql"),
  "utf8",
)
assert.match(migration, /idx_realtime_call_session_insights_computed_at/)
assert.match(migration, /idx_realtime_call_session_timeline_events_session_sequence/)

const operationsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/providers/realtime-provider-operations.ts"),
  "utf8",
)
assert.match(operationsSource, /fetchGrowthRealtimeCallSessionsByIds/)
assert.match(operationsSource, /getBrowserAudioStreamStatusChangedAt/)

const insightsRepoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/live-coaching/session-insights-repository.ts"),
  "utf8",
)
assert.match(insightsRepoSource, /providerId === "manual"/)
assert.match(insightsRepoSource, /count: "exact"/)

const providerSelectionUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-live-coaching-provider-selection.tsx"),
  "utf8",
)
assert.match(providerSelectionUi, /md:hidden/)
assert.match(providerSelectionUi, /hidden overflow-x-auto.*md:block/s)

const providersDashboardUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-providers-dashboard.tsx"),
  "utf8",
)
assert.match(providersDashboardUi, /cleanupFeedback/)
assert.match(providersDashboardUi, /staleStreamsClosed/)

const callIntelligenceUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-realtime-call-intelligence.tsx"),
  "utf8",
)
assert.match(callIntelligenceUi, /captureQaProof/)

console.log("growth-live-coaching-production-hardening: all checks passed")
