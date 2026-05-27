/**
 * Regression checks for Sequence Performance + Revenue Intelligence (Phase 2M).
 * Run: pnpm test:growth-revenue-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildSequenceFunnel,
  buildSequencePerformanceMetrics,
  computeRatePct,
  rankTopSequences,
} from "../lib/growth/revenue-intelligence/sequence-intelligence"
import {
  buildSenderPerformanceMetrics,
  senderHealthScore,
} from "../lib/growth/revenue-intelligence/sender-intelligence"
import {
  buildProviderPerformanceMetrics,
  providerHealthScore,
} from "../lib/growth/revenue-intelligence/provider-intelligence"
import {
  detectPerformanceTrend,
  detectRateTrend,
} from "../lib/growth/revenue-intelligence/trend-detector"
import {
  detectSequencePerformanceRisks,
  detectSenderPerformanceRisks,
  mergeRiskAlerts,
} from "../lib/growth/revenue-intelligence/risk-detector"
import {
  GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER,
  GROWTH_PERFORMANCE_RISK_TYPES,
  GROWTH_PERFORMANCE_TRENDS,
  GROWTH_SEQUENCE_PERFORMANCE_METRICS,
  performanceTrendLabel,
} from "../lib/growth/revenue-intelligence/revenue-intelligence-types"
import { GROWTH_SEQUENCE_REVENUE_INTELLIGENCE_SCHEMA_MIGRATION } from "../lib/growth/revenue-intelligence/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER, "growth-revenue-sequence-intelligence-v1")
  assert.match(GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE, /read-only/i)
  assert.match(GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE, /no autonomous/i)
  assert.equal(GROWTH_SEQUENCE_PERFORMANCE_METRICS.length, 20)
  assert.equal(GROWTH_PERFORMANCE_TRENDS.length, 4)
  assert.equal(GROWTH_PERFORMANCE_RISK_TYPES.length, 7)

  const migration = readSource(`supabase/migrations/${GROWTH_SEQUENCE_REVENUE_INTELLIGENCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.sequence_performance_snapshots/)
  assert.match(migration, /growth\.sender_performance_snapshots/)
  assert.match(migration, /growth\.provider_route_performance_snapshots/)
  assert.match(migration, /growth\.revenue_attribution_events/)
  assert.match(migration, /growth\.performance_intelligence_events/)
  assert.match(migration, /performance_risk_detected/)
  assert.match(migration, /revenue_attribution_recorded/)
  assert.match(migration, /service role only/)

  assert.equal(computeRatePct(25, 100), 25)
  assert.equal(computeRatePct(0, 0), 0)

  const metrics = buildSequencePerformanceMetrics({
    sent: 100,
    delivered: 98,
    opens: 40,
    clicks: 20,
    replies: 10,
    positiveReplies: 6,
    meetings: 3,
    opportunities: 2,
    wins: 1,
    pipelineValue: 50000,
    revenue: 25000,
    bounces: 5,
    unsubscribes: 2,
    complaints: 1,
  })
  assert.equal(metrics.reply_pct, 10)
  assert.equal(metrics.meeting_pct, 3)
  assert.equal(metrics.bounce_pct, 5)

  const funnel = buildSequenceFunnel(metrics)
  assert.equal(funnel[0]?.label, "Sent")
  assert.equal(funnel[funnel.length - 1]?.label, "Wins")

  const top = rankTopSequences([
    { sequenceId: "seq-a", sequenceLabel: "A", metrics, previousReplyPct: 8 },
  ])
  assert.equal(top[0]?.sequenceLabel, "A")

  assert.equal(detectPerformanceTrend({ current: 20, previous: 10 }), "improving")
  assert.equal(detectPerformanceTrend({ current: 5, previous: 20, higherIsBetter: true }), "critical")
  assert.equal(detectRateTrend(12, 10), "improving")
  assert.equal(performanceTrendLabel("declining"), "Declining")

  const senderMetrics = buildSenderPerformanceMetrics({
    sent: 200,
    hardBounces: 4,
    complaints: 1,
    opens: 50,
    clicks: 20,
    replies: 10,
  })
  assert.ok(senderHealthScore(senderMetrics) >= 0)
  assert.ok(senderMetrics.reputation_score <= 100)

  const providerMetrics = buildProviderPerformanceMetrics({
    attempts: 100,
    successes: 95,
    failures: 5,
    bounces: 3,
    complaints: 1,
    totalLatencyMs: 5000,
  })
  assert.ok(providerHealthScore(providerMetrics) >= 0)
  assert.equal(providerMetrics.delivery_success_pct, 95)

  const risks = mergeRiskAlerts([
    ...detectSequencePerformanceRisks({
      sequenceId: "seq-1",
      metrics: buildSequencePerformanceMetrics({ sent: 100, bounces: 20, unsubscribes: 5, complaints: 1 }),
    }),
    ...detectSenderPerformanceRisks({
      senderAccountId: "sender-1",
      metrics: buildSenderPerformanceMetrics({ sent: 1000, hardBounces: 50, complaints: 2 }),
    }),
  ])
  assert.ok(risks.some((risk) => risk.riskType === "bounce_spike"))

  const dashboardSource = readSource("lib/growth/revenue-intelligence/dashboard.ts")
  assert.match(dashboardSource, /fetchGrowthRevenueIntelligenceDashboard/)
  assert.match(dashboardSource, /variantLift/)
  assert.doesNotMatch(dashboardSource, /openai|anthropic|autoPromote|executeTransportSend/i)

  const snapshotsSource = readSource("lib/growth/revenue-intelligence/performance-snapshots.ts")
  assert.match(snapshotsSource, /recordPerformanceSnapshotAfterSend/)
  assert.match(snapshotsSource, /recordPerformanceEngagementFromDeliveryAttempt/)

  const attributionSource = readSource("lib/growth/revenue-intelligence/revenue-attribution.ts")
  assert.match(attributionSource, /recordRevenueAttributionEvent/)
  assert.match(attributionSource, /recordMeetingAttributionForLead/)
  assert.match(attributionSource, /recordReplyDraftPerformanceAttribution/)
  assert.doesNotMatch(attributionSource, /autoPromote|executeTransportSend/i)

  const runnerSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(runnerSource, /recordPerformanceSnapshotAfterSend/)

  const trackingSource = readSource("lib/growth/tracking/tracking-repository.ts")
  assert.match(trackingSource, /recordPerformanceEngagementFromDeliveryAttempt/)

  const complianceSource = readSource("lib/growth/compliance/compliance-repository.ts")
  assert.match(complianceSource, /recordPerformanceEngagementFromDeliveryAttempt/)

  const threadSource = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(threadSource, /recordMeetingAttributionForLead/)
  assert.match(threadSource, /recordPerformanceEngagementForLead/)

  const replyDraftSource = readSource("lib/growth/replies/reply-draft-repository.ts")
  assert.match(replyDraftSource, /recordReplyDraftPerformanceAttribution/)

  for (const route of [
    "app/api/platform/growth/intelligence/dashboard/route.ts",
    "app/api/platform/growth/intelligence/sequences/route.ts",
    "app/api/platform/growth/intelligence/senders/route.ts",
    "app/api/platform/growth/intelligence/providers/route.ts",
    "app/api/platform/growth/intelligence/revenue/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /isGrowthRevenueSequenceIntelligenceSchemaReady/)
    assert.doesNotMatch(source, /api_key|secret|password/i)
  }

  const uiSource = readSource("components/growth/growth-revenue-intelligence-dashboard.tsx")
  assert.match(uiSource, /GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER/)
  assert.match(uiSource, /Revenue Influenced/)
  assert.match(uiSource, /Meetings Generated/)
  assert.match(uiSource, /Reply Trend/)
  assert.match(uiSource, /Sender Health/)
  assert.match(uiSource, /Provider Health/)
  assert.match(uiSource, /Risk Alerts/)
  assert.match(uiSource, /Top Sequences/)
  assert.match(uiSource, /Sequence Funnel/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /\/admin\/growth\/revenue-intelligence/)

  console.log("growth-revenue-sequence-intelligence-v1: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
