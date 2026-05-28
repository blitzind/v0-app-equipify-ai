/**
 * Voice observability + orchestration analytics — Phase 5B regression checks.
 * Run: pnpm test:voice-observability-phase-5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildProviderDegradationAlerts,
  buildSpikeAlert,
  countActiveAlerts,
} from "../lib/voice/observability/alert-foundations"
import {
  buildAiOrchestrationSnapshot,
  emptyAiOrchestrationCounts,
} from "../lib/voice/observability/ai-orchestration-analytics"
import {
  buildCampaignAnalyticsSnapshot,
  emptyCampaignSourceCounts,
} from "../lib/voice/observability/campaign-analytics"
import {
  buildComplianceAnalyticsSnapshot,
  emptyComplianceSourceCounts,
  incrementChannelRisk,
} from "../lib/voice/observability/compliance-analytics"
import { buildEscalationAnalyticsSnapshot } from "../lib/voice/observability/escalation-analytics"
import { detectDegradationSignals } from "../lib/voice/observability/provider-health/degradation-detector"
import {
  aggregateProviderHealthMetrics,
  detectProviderDegradation,
} from "../lib/voice/observability/provider-health/provider-health-aggregator"
import {
  buildRelationshipRevenueSnapshot,
  emptyRelationshipRevenueCounts,
  incrementMapCount,
} from "../lib/voice/observability/relationship-revenue-analytics"
import {
  capEventsQuery,
  capRealtimePayload,
  observabilityRetentionCutoffIso,
  rollingWindowStartIso,
  shouldSampleObservabilityEvent,
  stripTranscriptPayload,
} from "../lib/voice/observability/retention-controls"
import {
  buildOverviewSnapshot,
  buildProviderHealthSnapshot,
  buildRealtimeSnapshot,
} from "../lib/voice/observability/snapshot-builder"
import {
  VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED,
  VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
  VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS,
  VOICE_OBSERVABILITY_HIDDEN_AI_SCORING_DISABLED,
  VOICE_OBSERVABILITY_MAX_EVENTS_QUERY,
  VOICE_OBSERVABILITY_MAX_REALTIME_ITEMS,
  VOICE_OBSERVABILITY_QA_MARKER,
  VOICE_OBSERVABILITY_REALTIME_POLL_MS,
  VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
} from "../lib/voice/observability/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_OBSERVABILITY_QA_MARKER, "voice-observability-analytics-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v20")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270620120000_voice_multichannel_intelligence_phase_6a")
assert.equal(VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED, true)
assert.equal(VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED, true)
assert.equal(VOICE_OBSERVABILITY_HIDDEN_AI_SCORING_DISABLED, true)
assert.equal(VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS, 90)
assert.equal(VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS, 24)
assert.equal(VOICE_OBSERVABILITY_MAX_EVENTS_QUERY, 500)
assert.equal(VOICE_OBSERVABILITY_MAX_REALTIME_ITEMS, 50)
assert.equal(VOICE_OBSERVABILITY_REALTIME_POLL_MS, 30_000)

// Provider health
const metrics = aggregateProviderHealthMetrics(
  [
    { sourceProvider: "deterministic", eventType: "provider_fallback", latencyMs: 2100, metadata: {} },
    { sourceProvider: "deterministic", eventType: "ai_response_generated", latencyMs: 800, metadata: {} },
    { sourceProvider: "deepgram", eventType: "provider_timeout", latencyMs: 2000, metadata: {} },
  ],
  24,
)
assert.ok(metrics.some((m) => m.providerId === "deterministic"))
assert.ok(metrics.some((m) => m.providerId === "deepgram"))
const degraded = detectProviderDegradation(metrics)
assert.ok(Array.isArray(degraded))

const signals = detectDegradationSignals(metrics)
const providerAlerts = buildProviderDegradationAlerts(signals)
assert.ok(Array.isArray(providerAlerts))

const providerSnapshot = buildProviderHealthSnapshot(metrics)
assert.equal(providerSnapshot.autoProviderSwitchDisabled, true)

// Spike alerts
const escalationAlert = buildSpikeAlert({
  alertType: "escalation_spike",
  count: 15,
  threshold: 10,
  windowLabel: "24h",
})
assert.ok(escalationAlert)
assert.equal(escalationAlert?.alertType, "escalation_spike")

const noAlert = buildSpikeAlert({
  alertType: "compliance_anomaly_spike",
  count: 2,
  threshold: 20,
  windowLabel: "24h",
})
assert.equal(noAlert, null)

// AI orchestration
const aiCounts = emptyAiOrchestrationCounts()
aiCounts.suggestionVolume = 10
aiCounts.suggestionsCopied = 3
aiCounts.escalationCount = 2
const aiSnapshot = buildAiOrchestrationSnapshot(aiCounts)
assert.equal(aiSnapshot.suggestionVolume24h, 10)
assert.ok(aiSnapshot.message.includes("factual"))

// Campaign analytics
const campaignCounts = emptyCampaignSourceCounts()
campaignCounts.voiceDropRecipients = 100
campaignCounts.voiceDropApproved = 50
campaignCounts.voiceDropDelivered = 40
const campaignSnapshot = buildCampaignAnalyticsSnapshot(campaignCounts)
assert.equal(campaignSnapshot.voiceDropDeliveryRate, 80)

// Compliance analytics
const complianceCounts = emptyComplianceSourceCounts()
complianceCounts.blocked24h = 5
incrementChannelRisk(complianceCounts.channelRisk, "callback", "blocked")
const complianceSnapshot = buildComplianceAnalyticsSnapshot(complianceCounts)
assert.equal(complianceSnapshot.blockedCount24h, 5)
assert.ok(complianceSnapshot.message.includes("No legal compliance score"))

// Escalation analytics
const escalationSnapshot = buildEscalationAnalyticsSnapshot({
  events: [
    { sourceSystem: "outbound_ai", eventType: "escalation_triggered", createdAt: new Date().toISOString() },
    { sourceSystem: "receptionist", eventType: "operator_joined", createdAt: new Date().toISOString() },
  ],
  windowHours: 24,
})
assert.equal(escalationSnapshot.escalationCount24h, 1)
assert.equal(escalationSnapshot.operatorTakeoverCount24h, 1)
assert.equal(escalationSnapshot.heatmap.length, 24)

// Relationship + revenue
const relCounts = emptyRelationshipRevenueCounts()
incrementMapCount(relCounts.retentionRisk, "churn_risk_increased")
relCounts.followUpNeeded = 5
relCounts.followUpResolved = 3
const relSnapshot = buildRelationshipRevenueSnapshot(relCounts)
assert.ok(relSnapshot.retentionRiskTrend.length > 0)

// Retention controls
assert.ok(rollingWindowStartIso(24).length > 0)
assert.ok(observabilityRetentionCutoffIso().length > 0)
assert.equal(shouldSampleObservabilityEvent("escalation_triggered"), true)
assert.equal(capEventsQuery([1, 2, 3]).length, 3)
assert.equal(capRealtimePayload(Array.from({ length: 100 }, (_, i) => i)).length, 50)

const stripped = stripTranscriptPayload({ transcript: "secret", count: 1 })
assert.equal(stripped.transcript, undefined)
assert.equal(stripped.count, 1)

// Realtime + overview snapshots
const realtime = buildRealtimeSnapshot({
  activeSessionsCount: 2,
  activeOutboundSessionsCount: 1,
  activeReceptionistSessionsCount: 1,
  providerHealthSummary: metrics,
  recentEvents: [],
  activeAlerts: [],
})
assert.equal(realtime.pollIntervalMs, 30_000)

const overview = buildOverviewSnapshot({
  schemaReady: true,
  observabilityEnabled: true,
  providerHealth: providerSnapshot,
  aiOrchestration: aiSnapshot,
  campaigns: campaignSnapshot,
  compliance: complianceSnapshot,
  escalations: escalationSnapshot,
  relationshipRevenue: relSnapshot,
  realtime,
  activeAlertCount: 0,
})
assert.equal(overview.autonomousRemediationDisabled, true)
assert.equal(overview.autoProviderSwitchDisabled, true)

assert.equal(countActiveAlerts([{ status: "active" } as never, { status: "resolved" } as never]), 1)

// Migration + routes + UI
const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20270618120000_voice_observability_analytics_phase_5b.sql",
)
assert.ok(fs.existsSync(migrationPath))
const migrationSql = fs.readFileSync(migrationPath, "utf8")
assert.match(migrationSql, /voice_observability_events/)
assert.match(migrationSql, /voice_observability_alert_states/)
assert.match(migrationSql, /voice_observability_metric_snapshots/)

const routes = [
  "app/api/platform/growth/voice/observability/overview/route.ts",
  "app/api/platform/growth/voice/observability/providers/route.ts",
  "app/api/platform/growth/voice/observability/escalations/route.ts",
  "app/api/platform/growth/voice/observability/compliance/route.ts",
  "app/api/platform/growth/voice/observability/campaigns/route.ts",
  "app/api/platform/growth/voice/observability/realtime/route.ts",
  "app/api/platform/growth/voice/observability/readiness/route.ts",
]
for (const route of routes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `Missing route: ${route}`)
}

assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/growth-voice-observability-dashboard.tsx")))
assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/growth-voice-observability-readiness-section.tsx")))

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /"v20"/)
assert.match(schemaHealth, /voice_observability_events/)
assert.match(schemaHealth, /voice_unified_communication_threads/)

console.log("voice-observability-phase-5b: all checks passed")
