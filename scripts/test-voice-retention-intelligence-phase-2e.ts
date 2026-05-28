/**
 * Voice retention intelligence — Phase 2E regression checks.
 * Run: pnpm test:voice-retention-intelligence-phase-2e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { countChurnRiskEvents, detectChurnRiskSignals } from "../lib/voice/retention-intelligence/churn-risk"
import { dedupeRetentionIntelligenceEvents, isDuplicateRetentionIntelligenceEvent, isStaleRetentionIntelligenceEvent } from "../lib/voice/retention-intelligence/deduplication"
import { countExpansionSignalEvents, detectExpansionSignals } from "../lib/voice/retention-intelligence/expansion-signals"
import { generateRetentionIntelligenceEvents } from "../lib/voice/retention-intelligence/event-generation"
import { scoreCustomerHealth } from "../lib/voice/retention-intelligence/health-scoring"
import {
  buildSatisfactionIndicators,
  collectUnresolvedIssues,
  countUnresolvedIssueEvents,
} from "../lib/voice/retention-intelligence/satisfaction-signals"
import { buildRetentionIntelligenceWorkspaceSnapshot } from "../lib/voice/retention-intelligence/snapshot-builder"
import {
  RETENTION_INTELLIGENCE_EVENTS_WINDOW,
  RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT,
  RETENTION_INTELLIGENCE_STALE_DAYS,
  VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_RETENTION_INTELLIGENCE_EVIDENCE_REQUIRED,
  VOICE_RETENTION_INTELLIGENCE_LIFECYCLE_ACTIONS,
  VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_RETENTION_INTELLIGENCE_QA_MARKER,
} from "../lib/voice/retention-intelligence/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_RETENTION_INTELLIGENCE_QA_MARKER, "voice-retention-intelligence-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v18")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270618120000_voice_observability_analytics_phase_5b")
assert.equal(VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED, true)
assert.equal(VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED, true)
assert.equal(VOICE_RETENTION_INTELLIGENCE_EVIDENCE_REQUIRED, true)
assert.deepEqual(VOICE_RETENTION_INTELLIGENCE_LIFECYCLE_ACTIONS, ["acknowledge", "dismiss", "resolve"])

const memoryEvent = {
  id: "m1",
  memoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceTranscriptSegmentId: "s1",
  memoryType: "cancellation_risk" as const,
  evidenceText: "We may not renew unless service improves",
  confidenceScore: 0.9,
  eventStatus: "active" as const,
  createdBySource: "draft_accept",
  createdAt: new Date().toISOString(),
}

const positiveEvent = {
  ...memoryEvent,
  id: "m2",
  memoryType: "positive_sentiment" as const,
  evidenceText: "Team is very happy with the platform",
}

const revenueEvent = {
  id: "r1",
  organizationId: "org-1",
  relatedCustomerId: "cust-1",
  relatedProspectId: null,
  relatedOpportunityId: null,
  relationshipMemoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceMemoryEventId: null,
  eventType: "renewal_risk" as const,
  buyingStage: "at_risk" as const,
  momentumDirection: "decelerating" as const,
  confidenceScore: 0.82,
  evidenceText: memoryEvent.evidenceText,
  recommendedOperatorAction: "Review renewal",
  status: "active" as const,
  createdAt: new Date().toISOString(),
}

const health = scoreCustomerHealth({
  memoryEvents: [memoryEvent, positiveEvent],
  revenueEvents: [revenueEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 1,
  relationshipStatus: "at_risk",
  sentimentTrend: "declining",
  lastInteractionAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
})
assert.ok(health.score >= 0 && health.score <= 100)
assert.ok(["elevated", "critical", "moderate"].includes(health.retentionRiskLevel))

const generated = generateRetentionIntelligenceEvents({
  memoryEvents: [memoryEvent, positiveEvent],
  revenueEvents: [revenueEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 1,
  relationshipStatus: "at_risk",
  sentimentTrend: "declining",
  lastInteractionAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
})
assert.ok(generated.some((event) => event.eventType === "renewal_risk"))
assert.ok(generated.some((event) => event.eventType === "satisfaction_signal"))
assert.ok(generated.some((event) => event.eventType === "churn_risk_increased"))

const risks = detectChurnRiskSignals([memoryEvent], [revenueEvent], 3)
assert.ok(risks.length >= 1)

const expansion = detectExpansionSignals([positiveEvent], [], 3)
assert.ok(expansion.length >= 1)

const satisfaction = buildSatisfactionIndicators([positiveEvent], 3)
assert.ok(satisfaction.some((item) => item.tone === "positive"))

const unresolved = collectUnresolvedIssues([memoryEvent], 3)
assert.ok(unresolved.length >= 1)

const retentionEvent = {
  id: "ret-1",
  organizationId: "org-1",
  relatedCustomerId: "cust-1",
  relatedProspectId: null,
  relatedOpportunityId: null,
  relationshipMemoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceMemoryEventId: "m1",
  sourceRevenueEventId: null,
  eventType: "renewal_risk" as const,
  healthDirection: "at_risk" as const,
  confidenceScore: 0.9,
  evidenceText: memoryEvent.evidenceText,
  recommendedOperatorAction: "Schedule retention call",
  status: "active" as const,
  createdAt: new Date().toISOString(),
}

assert.equal(dedupeRetentionIntelligenceEvents([retentionEvent, { ...retentionEvent, id: "ret-2" }]).length, 1)
assert.equal(
  isDuplicateRetentionIntelligenceEvent(
    [retentionEvent],
    {
      eventType: "renewal_risk",
      healthDirection: "at_risk",
      confidenceScore: 0.7,
      evidenceText: memoryEvent.evidenceText,
      recommendedOperatorAction: "x",
    },
    "p1",
    "cust-1",
  ),
  true,
)

const snapshot = buildRetentionIntelligenceWorkspaceSnapshot({
  relationshipMemoryProfileId: "p1",
  relatedCustomerId: "cust-1",
  memoryEvents: [memoryEvent, positiveEvent],
  revenueEvents: [revenueEvent],
  storedEvents: [retentionEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 1,
  relationshipStatus: "at_risk",
  sentimentTrend: "declining",
  lastInteractionAt: new Date().toISOString(),
})
assert.equal(snapshot.qaMarker, VOICE_RETENTION_INTELLIGENCE_QA_MARKER)
assert.ok(snapshot.topRisks.length >= 1)
assert.equal(snapshot.windowed, true)
assert.ok(snapshot.topActiveEvents.length >= 1)
assert.ok(snapshot.recommendedCustomerSuccessAction)

assert.ok(countChurnRiskEvents(["churn_risk_increased", "renewal_risk"]) >= 2)
assert.ok(countExpansionSignalEvents(["expansion_signal", "upsell_signal"]) >= 2)
assert.ok(countUnresolvedIssueEvents(["unresolved_issue_active", "follow_up_needed"]) >= 2)
assert.ok(isStaleRetentionIntelligenceEvent(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), RETENTION_INTELLIGENCE_STALE_DAYS))

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270611120000_voice_retention_intelligence_phase_2e.sql"),
  "utf8",
)
assert.match(migration, /voice_retention_intelligence_events/)
assert.match(migration, /churn_risk_increased/)
assert.match(migration, /source_revenue_event_id/)

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_retention_intelligence_events/)
assert.match(schemaHealth, /"v18"/)
assert.match(schemaHealth, /voice_ai_copilot_suggestions/)

const bridge = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"), "utf8")
assert.match(bridge, /fetchRetentionIntelligenceWorkspaceSnapshot/)
assert.match(bridge, /retentionIntelligence/)

const syncTypes = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/types.ts"), "utf8")
assert.match(syncTypes, /retentionIntelligence/)

const lifecycleRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/retention-intelligence/events/[eventId]/route.ts"),
  "utf8",
)
assert.match(lifecycleRoute, /updateRetentionIntelligenceEventLifecycle/)

const retentionPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-retention-intelligence-panel.tsx"),
  "utf8",
)
assert.match(retentionPanel, /VOICE_RETENTION_INTELLIGENCE_QA_MARKER/)
assert.match(retentionPanel, /Retention Intelligence/)
assert.match(retentionPanel, /Recommended success action/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /GrowthCallWorkspaceRetentionIntelligencePanel/)

assert.equal(RETENTION_INTELLIGENCE_EVENTS_WINDOW, 30)
assert.equal(RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT, 5)

console.log("voice-retention-intelligence-phase-2e: all checks passed")
