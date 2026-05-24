/**
 * Regression checks for Growth Engine Live Coaching trends (slice 6.13C).
 * Run: pnpm test:growth-live-coaching-trends
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCoachingTrendsPayload,
  filterCoachingTrendsRollups,
  parseCoachingTrendsDateRangeDays,
  parseCoachingTrendsProviderFilter,
  parseCoachingTrendsRiskFilter,
} from "../lib/growth/realtime/live-coaching/coaching-trends-aggregation"
import {
  buildLiveCoachingTrendsQaProofMarker,
  LIVE_COACHING_TRENDS_QA_PROOF_MARKER,
} from "../lib/growth/realtime/live-coaching/live-coaching-production-proof"
import type { LiveCoachingSessionInsightsRollup } from "../lib/growth/realtime/live-coaching/session-insights-types"

function rollup(
  overrides: Partial<LiveCoachingSessionInsightsRollup> = {},
): LiveCoachingSessionInsightsRollup {
  return {
    sessionId: overrides.sessionId ?? "11111111-1111-4111-8111-111111111111",
    leadId: overrides.leadId ?? "22222222-2222-4222-8222-222222222222",
    sessionDurationMs: 120000,
    providerId: "deepgram",
    transcriptFinalizedCount: 3,
    guidanceGeneratedCount: 2,
    objectionCount: 1,
    buyingSignalCount: 1,
    discoveryGapCount: 0,
    competitorPressureCount: 0,
    providerInterruptions: 0,
    reconnectAttempts: 0,
    retryAttempts: 0,
    fallbackCount: 0,
    averageTranscriptLatencyMs: 120,
    maxTranscriptLatencyMs: 180,
    sessionHealthScore: 88,
    riskLevel: "low",
    computedAt: "2026-05-18T12:00:00.000Z",
    ...overrides,
  }
}

const rollups: LiveCoachingSessionInsightsRollup[] = [
  rollup({ sessionId: "11111111-1111-4111-8111-111111111111", computedAt: "2026-05-17T12:00:00.000Z" }),
  rollup({
    sessionId: "33333333-3333-4333-8333-333333333333",
    providerId: "assemblyai",
    sessionHealthScore: 62,
    riskLevel: "medium",
    providerInterruptions: 2,
    retryAttempts: 1,
    objectionCount: 2,
    computedAt: "2026-05-18T12:00:00.000Z",
  }),
  rollup({
    sessionId: "44444444-4444-4444-8444-444444444444",
    providerId: "deepgram",
    sessionHealthScore: 40,
    riskLevel: "critical",
    providerInterruptions: 4,
    fallbackCount: 1,
    computedAt: "2026-05-18T15:00:00.000Z",
    maxTranscriptLatencyMs: 420,
    averageTranscriptLatencyMs: 300,
  }),
]

const payload = buildCoachingTrendsPayload({
  rollups,
  filters: { dateRangeDays: 30, providerId: null, riskLevel: null },
  meta: { total: rollups.length, limit: 5000, truncated: false },
  qaProof: buildLiveCoachingTrendsQaProofMarker({ sessionCount: rollups.length }),
})

assert.equal(payload.summary.sessionCount, 3)
assert.equal(payload.summary.averageHealthScore, 63)
assert.equal(payload.riskDistribution.critical, 1)
assert.equal(payload.riskDistribution.medium, 1)
assert.equal(payload.sessionsByProvider.length, 2)
assert.equal(payload.dailyTrend.length, 2)
assert.equal(payload.dailyTrend[1]?.sessionCount, 2)

const providerFiltered = buildCoachingTrendsPayload({
  rollups: filterCoachingTrendsRollups(rollups, { providerId: "deepgram", riskLevel: null }),
  filters: { dateRangeDays: 30, providerId: "deepgram", riskLevel: null },
  meta: { total: 2, limit: 5000, truncated: false },
  qaProof: buildLiveCoachingTrendsQaProofMarker({ sessionCount: 2 }),
})
assert.equal(providerFiltered.summary.sessionCount, 2)

const riskFiltered = buildCoachingTrendsPayload({
  rollups: filterCoachingTrendsRollups(rollups, { providerId: null, riskLevel: "medium" }),
  filters: { dateRangeDays: 30, providerId: null, riskLevel: "medium" },
  meta: { total: 1, limit: 5000, truncated: false },
  qaProof: buildLiveCoachingTrendsQaProofMarker({ sessionCount: 1 }),
})
assert.equal(riskFiltered.summary.sessionCount, 1)
assert.equal(riskFiltered.summary.totalObjections, 2)

assert.equal(parseCoachingTrendsDateRangeDays("7"), 7)
assert.equal(parseCoachingTrendsDateRangeDays("30"), 30)
assert.equal(parseCoachingTrendsDateRangeDays("invalid"), 30)

assert.equal(parseCoachingTrendsProviderFilter("all"), null)
assert.equal(parseCoachingTrendsProviderFilter("deepgram"), "deepgram")

assert.equal(parseCoachingTrendsRiskFilter("all"), null)
assert.equal(parseCoachingTrendsRiskFilter("high"), "high")
assert.equal(parseCoachingTrendsRiskFilter("invalid"), null)

const proof = buildLiveCoachingTrendsQaProofMarker({ sessionCount: 3 })
assert.equal(proof.marker, LIVE_COACHING_TRENDS_QA_PROOF_MARKER)
assert.equal(proof.verified, true)

const truncatedProof = buildLiveCoachingTrendsQaProofMarker({ sessionCount: 5000, truncated: true })
assert.equal(truncatedProof.verified, false)

const trendsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/live-coaching/trends/route.ts"),
  "utf8",
)
const trendsUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-live-coaching-trends.tsx"),
  "utf8",
)
const aggregationSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/live-coaching/coaching-trends-aggregation.ts"),
  "utf8",
)

assert.match(trendsRoute, /requireGrowthEnginePlatformAccess/, "trends API is platform-admin gated")
assert.match(trendsUi, /Coaching Trends/, "dashboard renders coaching trends section")
assert.match(trendsUi, /No session insights in this range yet/, "trends UI has empty state")
assert.match(trendsUi, /qaProof/, "trends UI renders QA proof marker")
assert.doesNotMatch(aggregationSource, /audioBase64/)
assert.doesNotMatch(aggregationSource, /transcriptText/)

console.log("growth-live-coaching-trends: all checks passed")
