/**
 * Voice relationship memory — Phase 2C regression checks.
 * Run: pnpm test:voice-relationship-memory-phase-2c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { aggregateProfileMetrics, detectRecurringIssues } from "../lib/voice/relationship-memory/aggregation"
import { dedupeRelationshipMemoryEvents, isDuplicateMemoryEvent } from "../lib/voice/relationship-memory/deduplication"
import { mapDraftKindToMemoryType, normalizePhoneForMemoryProfile } from "../lib/voice/relationship-memory/draft-mapping"
import { computeHighRiskScore, rankRelationshipInsights } from "../lib/voice/relationship-memory/prioritization"
import { buildRelationshipTimeline, filterRelationshipTimeline } from "../lib/voice/relationship-memory/timeline"
import {
  RELATIONSHIP_MEMORY_EVENTS_WINDOW,
  RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
  VOICE_RELATIONSHIP_MEMORY_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_RELATIONSHIP_MEMORY_PASSIVE_MODE_ENABLED,
  VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
} from "../lib/voice/relationship-memory/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_RELATIONSHIP_MEMORY_QA_MARKER, "voice-relationship-memory-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v10")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270610120000_voice_revenue_intelligence_phase_2d")
assert.equal(VOICE_RELATIONSHIP_MEMORY_PASSIVE_MODE_ENABLED, true)
assert.equal(VOICE_RELATIONSHIP_MEMORY_AUTONOMOUS_ACTIONS_DISABLED, true)

assert.equal(normalizePhoneForMemoryProfile("4155550199"), "+14155550199")
assert.equal(mapDraftKindToMemoryType("objection"), "pricing_objection")
assert.equal(mapDraftKindToMemoryType("competitor"), "competitor_mention")

const sampleEvent = {
  id: "e1",
  memoryProfileId: "p1",
  sourceVoiceCallId: "c1",
  sourceTranscriptSegmentId: "s1",
  memoryType: "pricing_objection" as const,
  evidenceText: "price is too high for our budget",
  confidenceScore: 0.9,
  eventStatus: "active" as const,
  createdBySource: "draft_accept",
  createdAt: new Date().toISOString(),
}

const duplicate = { ...sampleEvent, id: "e2", confidenceScore: 0.7 }
assert.equal(dedupeRelationshipMemoryEvents([sampleEvent, duplicate]).length, 1)
assert.equal(isDuplicateMemoryEvent([sampleEvent], { memoryType: "pricing_objection", evidenceText: sampleEvent.evidenceText }), true)

const profile = {
  id: "p1",
  organizationId: "org-1",
  relatedCustomerId: null,
  relatedProspectId: null,
  primaryContactName: "Alex",
  primaryPhoneNumber: "+14155550199",
  relationshipStatus: "active" as const,
  firstInteractionAt: new Date().toISOString(),
  lastInteractionAt: new Date().toISOString(),
  totalCallCount: 3,
  totalTalkTimeSeconds: 900,
  objectionCount: 2,
  buyingSignalCount: 1,
  escalationCount: 0,
  sentimentTrend: "stable" as const,
  metadataJson: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const metrics = aggregateProfileMetrics({
  events: [sampleEvent],
  callCount: 3,
  totalTalkTimeSeconds: 900,
  firstInteractionAt: profile.firstInteractionAt,
  lastInteractionAt: profile.lastInteractionAt,
})
assert.ok(metrics.objectionCount >= 1)

const insights = rankRelationshipInsights([sampleEvent], profile, 5)
assert.ok(insights.length >= 1)
assert.ok(computeHighRiskScore(profile, [sampleEvent]) >= 0)

const timeline = buildRelationshipTimeline({
  memoryEvents: [sampleEvent],
  callSummaries: [
    {
      voiceCallId: "c1",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      direction: "outbound",
      durationSeconds: 300,
    },
  ],
  limit: RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
})
assert.ok(timeline.length >= 2)
assert.ok(filterRelationshipTimeline(timeline, "objections").length >= 1)

assert.ok(detectRecurringIssues([sampleEvent, { ...sampleEvent, id: "e3" }]).length >= 1)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270609120000_voice_relationship_memory_phase_2c.sql"),
  "utf8",
)
assert.match(migration, /voice_relationship_memory_profiles/)
assert.match(migration, /voice_relationship_memory_events/)
assert.match(migration, /operator_notes/)

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_relationship_memory_profiles/)
assert.match(schemaHealth, /"v10"/)

const bridge = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"), "utf8")
assert.match(bridge, /fetchRelationshipMemoryWorkspaceSnapshot/)
assert.match(bridge, /relationshipMemory/)

const syncTypes = fs.readFileSync(path.join(process.cwd(), "lib/voice/browser-calling/types.ts"), "utf8")
assert.match(syncTypes, /relationshipMemory/)

const draftRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/memory-drafts/[draftId]/route.ts"),
  "utf8",
)
assert.match(draftRoute, /reviewVoiceMemoryDraft/)

const profileRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/relationships/[profileId]/route.ts"),
  "utf8",
)
assert.match(profileRoute, /getRelationshipMemoryProfile/)

const workspace = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"), "utf8")
assert.match(workspace, /data-voice-relationship-memory-qa-marker/)
assert.match(workspace, /relationshipMemory=\{voiceBrowser\.snapshot\?\.relationshipMemory/)

const memoryPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-relationship-memory-panel.tsx"),
  "utf8",
)
assert.match(memoryPanel, /VOICE_RELATIONSHIP_MEMORY_QA_MARKER/)
assert.match(memoryPanel, /Memory drafts — review required/)
assert.match(memoryPanel, /Relationship timeline/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /GrowthCallWorkspaceRelationshipMemoryPanel/)
assert.match(intelligenceRail, /previousConversationsLabel/)

assert.equal(RELATIONSHIP_MEMORY_TIMELINE_WINDOW, 24)
assert.equal(RELATIONSHIP_MEMORY_EVENTS_WINDOW, 40)

console.log("voice-relationship-memory-phase-2c: all checks passed")
