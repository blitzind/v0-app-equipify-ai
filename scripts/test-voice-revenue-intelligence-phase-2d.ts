/**
 * Voice revenue intelligence — Phase 2D regression checks.
 * Run: pnpm test:voice-revenue-intelligence-phase-2d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { resolveBuyingStage, inferStageMovement, compareBuyingStages } from "../lib/voice/revenue-intelligence/buying-stage-resolver"
import { dedupeRevenueIntelligenceEvents, isDuplicateRevenueIntelligenceEvent, isStaleRevenueIntelligenceEvent } from "../lib/voice/revenue-intelligence/deduplication"
import { generateRevenueIntelligenceEvents } from "../lib/voice/revenue-intelligence/event-generation"
import { analyzeFollowUpHealth, countFollowUpRiskEvents } from "../lib/voice/revenue-intelligence/follow-up-health"
import { scoreMomentum } from "../lib/voice/revenue-intelligence/momentum-scoring"
import { buildTopRisks, scoreDealRisk } from "../lib/voice/revenue-intelligence/risk-scoring"
import { buildRevenueIntelligenceWorkspaceSnapshot } from "../lib/voice/revenue-intelligence/snapshot-builder"
import {
  REVENUE_INTELLIGENCE_EVENTS_WINDOW,
  REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT,
  REVENUE_INTELLIGENCE_STALE_DAYS,
  VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_REVENUE_INTELLIGENCE_EVIDENCE_REQUIRED,
  VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS,
  VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
} from "../lib/voice/revenue-intelligence/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_REVENUE_INTELLIGENCE_QA_MARKER, "voice-revenue-intelligence-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v16")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270616120000_voice_compliance_orchestration_phase_4c")
assert.equal(VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED, true)
assert.equal(VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED, true)
assert.equal(VOICE_REVENUE_INTELLIGENCE_EVIDENCE_REQUIRED, true)
assert.deepEqual(VOICE_REVENUE_INTELLIGENCE_LIFECYCLE_ACTIONS, ["acknowledge", "dismiss", "resolve"])

const memoryEvent = {
  id: "m1",
  memoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceTranscriptSegmentId: "s1",
  memoryType: "booking_interest" as const,
  evidenceText: "Ready to schedule a demo next week",
  confidenceScore: 0.88,
  eventStatus: "active" as const,
  createdBySource: "draft_accept",
  createdAt: new Date().toISOString(),
}

const objectionEvent = {
  ...memoryEvent,
  id: "m2",
  memoryType: "pricing_objection" as const,
  evidenceText: "Price is too high for our budget this quarter",
}

const stage = resolveBuyingStage({
  memoryEvents: [memoryEvent, objectionEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 0,
  relationshipStatus: "active",
})
assert.ok(["evaluation", "negotiation", "commitment"].includes(stage))

const generated = generateRevenueIntelligenceEvents({
  memoryEvents: [memoryEvent, objectionEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 0,
  relationshipStatus: "active",
  lastInteractionAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  previousBuyingStage: "discovery",
})
assert.ok(generated.some((event) => event.eventType === "ready_to_book"))
assert.ok(generated.some((event) => event.eventType === "budget_objection_active"))

const momentum = scoreMomentum({
  memoryEvents: [memoryEvent],
  buyingSignalCount: 2,
  objectionCount: 0,
  escalationCount: 0,
  daysSinceLastInteraction: 3,
})
assert.ok(momentum.score >= 50)

const risk = scoreDealRisk({
  memoryEvents: [objectionEvent],
  objectionCount: 1,
  escalationCount: 0,
  relationshipStatus: "active",
})
assert.ok(risk >= 10)

const followUp = analyzeFollowUpHealth({
  lastInteractionAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  memoryEvents: [{ ...memoryEvent, memoryType: "follow_up_request" }],
})
assert.equal(followUp.status, "overdue")
assert.ok(countFollowUpRiskEvents(followUp) >= 1)

const revenueEvent = {
  id: "r1",
  organizationId: "org-1",
  relatedCustomerId: null,
  relatedProspectId: null,
  relatedOpportunityId: null,
  relationshipMemoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceMemoryEventId: "m1",
  eventType: "ready_to_book" as const,
  buyingStage: "negotiation" as const,
  momentumDirection: "accelerating" as const,
  confidenceScore: 0.88,
  evidenceText: memoryEvent.evidenceText,
  recommendedOperatorAction: "Offer meeting times",
  status: "active" as const,
  createdAt: new Date().toISOString(),
}

assert.equal(dedupeRevenueIntelligenceEvents([revenueEvent, { ...revenueEvent, id: "r2" }]).length, 1)
assert.equal(
  isDuplicateRevenueIntelligenceEvent(
    [revenueEvent],
    {
      eventType: "ready_to_book",
      buyingStage: "negotiation",
      momentumDirection: "accelerating",
      confidenceScore: 0.7,
      evidenceText: memoryEvent.evidenceText,
      recommendedOperatorAction: "x",
    },
    "p1",
    null,
  ),
  true,
)

const snapshot = buildRevenueIntelligenceWorkspaceSnapshot({
  relationshipMemoryProfileId: "p1",
  relatedOpportunityId: null,
  memoryEvents: [memoryEvent, objectionEvent],
  storedEvents: [revenueEvent],
  objectionCount: 1,
  buyingSignalCount: 1,
  escalationCount: 0,
  relationshipStatus: "active",
  lastInteractionAt: new Date().toISOString(),
})
assert.equal(snapshot.qaMarker, VOICE_REVENUE_INTELLIGENCE_QA_MARKER)
assert.ok(snapshot.topRisks.length >= 1)
assert.ok(snapshot.topBuyingSignals.length >= 1)
assert.equal(snapshot.windowed, true)
assert.ok(snapshot.topActiveEvents.length >= 1)
assert.ok(snapshot.nextRecommendedOperatorAction)

const movement = inferStageMovement("discovery", stage, "Stage changed")
assert.ok(movement)

assert.ok(compareBuyingStages("discovery", "negotiation") > 0)
assert.ok(isStaleRevenueIntelligenceEvent(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), REVENUE_INTELLIGENCE_STALE_DAYS))

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270610120000_voice_revenue_intelligence_phase_2d.sql"),
  "utf8",
)
assert.match(migration, /voice_revenue_intelligence_events/)
assert.match(migration, /stage_progression/)
assert.match(migration, /acknowledged/)

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_revenue_intelligence_events/)
assert.match(schemaHealth, /"v16"/)
assert.match(schemaHealth, /voice_ai_copilot_suggestions/)

const bridge = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"), "utf8")
assert.match(bridge, /fetchRevenueIntelligenceWorkspaceSnapshot/)
assert.match(bridge, /revenueIntelligence/)

const syncTypes = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/types.ts"), "utf8")
assert.match(syncTypes, /revenueIntelligence/)

const lifecycleRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/revenue-intelligence/events/[eventId]/route.ts"),
  "utf8",
)
assert.match(lifecycleRoute, /updateRevenueIntelligenceEventLifecycle/)

const snapshotRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/revenue-intelligence/snapshot/route.ts"),
  "utf8",
)
assert.match(snapshotRoute, /fetchRevenueIntelligenceWorkspaceSnapshot/)

const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
assert.match(workspace, /data-voice-revenue-intelligence-qa-marker/)
assert.match(workspace, /revenueIntelligence=\{voiceBrowser\.snapshot\?\.revenueIntelligence/)

const revenuePanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-revenue-intelligence-panel.tsx"),
  "utf8",
)
assert.match(revenuePanel, /VOICE_REVENUE_INTELLIGENCE_QA_MARKER/)
assert.match(revenuePanel, /Revenue Intelligence/)
assert.match(revenuePanel, /What changed since last call/)
assert.match(revenuePanel, /Recommended next revenue action/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /GrowthCallWorkspaceRevenueIntelligencePanel/)

const readinessSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-revenue-intelligence-readiness-section.tsx"),
  "utf8",
)
assert.match(readinessSection, /Revenue Intelligence Readiness/)

assert.equal(REVENUE_INTELLIGENCE_EVENTS_WINDOW, 30)
assert.equal(REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT, 5)

console.log("voice-revenue-intelligence-phase-2d: all checks passed")
