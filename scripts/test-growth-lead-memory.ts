/**
 * Regression checks for Lead Intelligence Memory + Relationship Context Engine (Phase 2T).
 * Run: pnpm test:growth-lead-memory
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  hasMinimumMemoryEvidence,
  ingestMemoryCandidatesFromSource,
} from "../lib/growth/lead-memory/memory-ingestion"
import { mapCandidateToObjection, rankObjections } from "../lib/growth/lead-memory/objection-memory"
import { mapCandidateToPreference, rankPreferences } from "../lib/growth/lead-memory/preference-memory"
import {
  aggregateHighestConfidence,
  computeMemoryCoverageScore,
  inferRelationshipStage,
  stageDistribution,
} from "../lib/growth/lead-memory/relationship-context"
import { buildRelationshipSummary } from "../lib/growth/lead-memory/relationship-summary"
import {
  GROWTH_LEAD_MEMORY_CATEGORIES,
  GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER,
  GROWTH_LEAD_MEMORY_PRIVACY_NOTE,
  GROWTH_MEMORY_CONFIDENCE_LEVELS,
  GROWTH_RELATIONSHIP_STAGES,
  sanitizeMemoryEvidenceSnippet,
} from "../lib/growth/lead-memory/memory-types"
import { GROWTH_LEAD_MEMORY_ENGINE_SCHEMA_MIGRATION } from "../lib/growth/lead-memory/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER, "growth-lead-memory-engine-v1")
  assert.match(GROWTH_LEAD_MEMORY_PRIVACY_NOTE, /No autonomous CRM mutation/i)
  assert.match(GROWTH_LEAD_MEMORY_PRIVACY_NOTE, /no hidden memory/i)
  assert.match(GROWTH_LEAD_MEMORY_PRIVACY_NOTE, /no provider payloads/i)
  assert.equal(GROWTH_LEAD_MEMORY_CATEGORIES.length, 12)
  assert.equal(GROWTH_RELATIONSHIP_STAGES.length, 7)
  assert.equal(GROWTH_MEMORY_CONFIDENCE_LEVELS.length, 4)

  const migration = readSource(`supabase/migrations/${GROWTH_LEAD_MEMORY_ENGINE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.lead_memory_profiles/)
  assert.match(migration, /growth\.lead_memory_events/)
  assert.match(migration, /growth\.lead_objection_memory/)
  assert.match(migration, /growth\.lead_preference_memory/)
  assert.match(migration, /growth\.relationship_context/)
  assert.match(migration, /growth\.committee_relationship_context/)
  assert.match(migration, /growth\.relationship_summary_snapshots/)
  assert.match(migration, /communication_preference/)
  assert.match(migration, /lead_memory_recorded/)
  assert.match(migration, /lead_memory_rebuilt/)
  assert.match(migration, /service role only/i)

  const sanitized = sanitizeMemoryEvidenceSnippet("Bearer secret-token api_key=abc123")
  assert.match(sanitized, /\[redacted\]/i)
  assert.ok(!sanitized.includes("secret-token"))

  const inboxCandidates = ingestMemoryCandidatesFromSource({
    sourceSystem: "inbox",
    subject: "Demo next week",
    body: "Can we schedule a call to walk through pricing and budget?",
    classification: "meeting_intent",
    meetingIntent: true,
    budgetMention: true,
  })
  assert.ok(inboxCandidates.some((c) => c.memoryCategory === "meeting_signal"))
  assert.ok(inboxCandidates.some((c) => c.memoryCategory === "budget_signal"))
  assert.ok(inboxCandidates.every((c) => hasMinimumMemoryEvidence(c.evidenceSnippet)))

  const objectionCandidates = ingestMemoryCandidatesFromSource({
    sourceSystem: "inbox",
    body: "We are not interested right now — budget is tight for this quarter.",
  })
  const objection = mapCandidateToObjection(
    objectionCandidates.find((c) => c.memoryCategory === "objection") ?? objectionCandidates[0]!,
  )
  assert.ok(objection)
  assert.equal(objection!.objectionType, "budget")

  const prefCandidate = ingestMemoryCandidatesFromSource({
    sourceSystem: "inbox",
    body: "Please email me in the morning — I prefer email over calls.",
  }).find((c) => c.memoryCategory === "communication_preference")
  assert.ok(prefCandidate)
  const preference = mapCandidateToPreference(prefCandidate!)
  assert.ok(preference)
  assert.equal(preference!.preferenceType, "communication_preference")

  const stage = inferRelationshipStage({
    events: [{ memoryCategory: "engagement_pattern", confidence: "medium" }],
    engagementTier: "engaged",
  })
  assert.equal(stage, "engaged")

  const coverage = computeMemoryCoverageScore({
    eventCount: 6,
    objectionCount: 1,
    preferenceCount: 1,
    committeeCount: 1,
    categoryCount: 4,
  })
  assert.ok(coverage >= 0 && coverage <= 100)

  const highest = aggregateHighestConfidence([{ confidence: "medium" }, { confidence: "high" }])
  assert.equal(highest, "high")

  const distribution = stageDistribution([
    { relationshipStage: "aware" },
    { relationshipStage: "engaged" },
    { relationshipStage: "engaged" },
  ])
  assert.equal(distribution.aware, 1)
  assert.equal(distribution.engaged, 2)

  const ranked = rankObjections([
    {
      id: "1",
      leadLabel: "Acme",
      objectionType: "budget",
      objectionLabel: "Budget objection",
      severity: "medium",
      confidence: "medium",
      evidenceSnippet: "Budget is tight this quarter.",
      occurrenceCount: 2,
      resolved: false,
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "2",
      leadLabel: "Beta",
      objectionType: "timing",
      objectionLabel: "Timing objection",
      severity: "low",
      confidence: "low",
      evidenceSnippet: "Not now — maybe next quarter.",
      occurrenceCount: 1,
      resolved: false,
      lastSeenAt: new Date().toISOString(),
    },
  ])
  assert.equal(ranked[0]?.occurrenceCount, 2)

  const prefs = rankPreferences([
    {
      id: "p1",
      leadLabel: "Acme",
      preferenceType: "communication_preference",
      preferenceKey: "channel",
      preferenceValue: "email",
      confidence: "high",
      evidenceSnippet: "Prefers email contact in the morning.",
    },
  ])
  assert.equal(prefs.length, 1)

  const summary = buildRelationshipSummary({
    leadLabel: "Acme Corp",
    relationshipStage: "engaged",
    memoryCoverageScore: 72,
    topObjections: ranked,
    topPreferences: prefs,
    committeeMembers: [],
    eventCount: 8,
  })
  assert.match(summary, /Acme Corp/)
  assert.match(summary, /engaged/)

  const dashboardRoute = readSource("app/api/platform/growth/lead-memory/dashboard/route.ts")
  assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)
  assert.match(dashboardRoute, /isGrowthLeadMemoryEngineSchemaReady/)

  const rebuildRoute = readSource("app/api/platform/growth/lead-memory/rebuild/[leadId]/route.ts")
  assert.match(rebuildRoute, /rebuildLeadMemoryProfile/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /relationship-memory/)
  assert.match(navSource, /Relationship Memory/)

  const drawerSource = readSource("components/growth/growth-lead-drawer.tsx")
  assert.match(drawerSource, /GrowthLeadRelationshipMemoryPanel/)

  const inboxSource = readSource("components/growth/growth-unified-inbox-dashboard.tsx")
  assert.match(inboxSource, /GrowthInboxRelationshipMemoryPanel/)

  const callSource = readSource("components/growth/growth-call-workspace-intelligence-rail.tsx")
  assert.match(callSource, /GrowthCallWorkspaceRelationshipSummaryPanel/)

  const sequenceSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
  assert.match(sequenceSource, /Objection Memory/)
  assert.match(sequenceSource, /relationship-memory/)

  const bookingSource = readSource("components/growth/growth-booking-intelligence-dashboard.tsx")
  assert.match(bookingSource, /Preference Memory/)
  assert.match(bookingSource, /relationship-memory/)

  console.log("growth lead memory engine checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
