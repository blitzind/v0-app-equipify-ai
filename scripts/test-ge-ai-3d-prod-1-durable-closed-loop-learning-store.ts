/**
 * GE-AI-3D-PROD-1 — Durable Closed-Loop Learning Store certification.
 * Run: pnpm test:ge-ai-3d-prod-1-durable-closed-loop-learning-store
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  mapClosedLoopLearningInsightRow,
  mapClosedLoopLearningOutcomeRow,
  closedLoopLearningSchemaCatalog,
} from "../lib/growth/aios/learning/growth-closed-loop-learning-repository"
import { GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_OBJECTS } from "../lib/growth/aios/learning/growth-closed-loop-learning-schema-health"
import {
  buildLearningInsightIdempotencyKey,
  buildLearningOutcomeIdempotencyKey,
  GROWTH_AIOS_GE_AI_3D_PROD_1_PHASE,
  GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
  GROWTH_CLOSED_LOOP_LEARNING_RULE,
  GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION,
  resolveLearningInsightWindow,
  type GrowthLearningInsight,
  type GrowthLearningOutcome,
} from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  buildGrowthClosedLoopLearningReadModel,
  enrichCommunicationEngineWithLearningInsights,
  enrichRevenueDirectorWithLearningInsights,
  synthesizeEmptyClosedLoopLearningReadModel,
} from "../lib/growth/aios/learning/growth-closed-loop-learning-service"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "../lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "../lib/growth/aios/revenue-director/growth-revenue-director-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_GE_AI_3D_PROD_1_PHASE}] Durable Closed-Loop Learning Store certification`)

assert.equal(
  GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION,
  "20271001230000_growth_ai_3d_prod_1_closed_loop_learning_store.sql",
)

const requiredFiles = [
  "lib/growth/aios/learning/growth-closed-loop-learning-repository.ts",
  "lib/growth/aios/learning/growth-closed-loop-learning-schema-health.ts",
  `supabase/migrations/${GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION}`,
  "docs/GE-AI-3D-PROD-1_DURABLE_CLOSED_LOOP_LEARNING_STORE.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const migration = readSource(`supabase/migrations/${GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.closed_loop_learning_outcomes"))
assert.ok(migration.includes("growth.closed_loop_learning_insights"))
assert.ok(migration.includes("growth.closed_loop_learning_events"))
assert.ok(migration.includes("closed_loop_learning_outcomes_idempotency_uidx"))
assert.ok(migration.includes("closed_loop_learning_insights_idempotency_uidx"))
assert.ok(migration.includes("service_role"))
assert.equal(migration.includes("public.invoices"), false)

const service = readSource("lib/growth/aios/learning/growth-closed-loop-learning-service.ts")
assert.ok(service.includes("fetchGrowthClosedLoopLearningReadModel"))
assert.ok(service.includes("upsertClosedLoopLearningOutcome"))
assert.ok(service.includes("GROWTH_LEARNING_IN_MEMORY_STORE"))
assert.equal(service.includes("runSequenceExecutionJob"), false)
assert.equal(service.includes("updateIcp"), false)
assert.equal(service.includes("setChannelWeight"), false)
assert.equal(service.includes("mutateGrowthAutonomy"), false)

const registry = readSource("lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry.ts")
assert.ok(registry.includes("observeClosedLoopLearningEventForBus"))

assert.equal(GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_OBJECTS.length, 3)
assert.deepEqual(closedLoopLearningSchemaCatalog().tables, [
  "closed_loop_learning_outcomes",
  "closed_loop_learning_insights",
  "closed_loop_learning_events",
])

const outcomeRow = {
  id: "out-1",
  organization_id: "org-1",
  source: "email",
  outcome_type: "reply",
  subject_type: "lead",
  subject_id: "lead-1",
  related: { workflowRequestId: "req-1" },
  signal_strength: 0.88,
  confidence: 0.9,
  dimensions: { channel: "email" },
  evidence: [{ source: "test", label: "channel", value: "email" }],
  occurred_at: "2026-06-27T12:00:00.000Z",
  idempotency_key: "learning-outcome:org-1:evt-1",
  created_at: "2026-06-27T12:00:01.000Z",
}

const mappedOutcome = mapClosedLoopLearningOutcomeRow(outcomeRow)
assert.equal(mappedOutcome.source, "email")
assert.equal(mappedOutcome.outcomeType, "reply")
assert.equal(mappedOutcome.related.workflowRequestId, "req-1")

const insightRow = {
  id: "ins-1",
  organization_id: "org-1",
  insight_type: "channel_performance",
  title: "SMS outperforming email",
  summary: "Advisory only",
  recommended_adjustment: "test_variant",
  target_system: "communication_engine",
  confidence: 0.82,
  impact: 0.55,
  sample_size: 4,
  evidence: [mappedOutcome],
  status: "advisory",
  generated_from_window: "2026-06-27",
  idempotency_key: "learning-insight:org-1:channel_performance:2026-06-27",
  created_at: "2026-06-27T12:00:02.000Z",
  superseded_at: null,
}

const mappedInsight = mapClosedLoopLearningInsightRow(insightRow)
assert.equal(mappedInsight.insightType, "channel_performance")
assert.equal(mappedInsight.sampleSize, 4)

assert.equal(
  buildLearningOutcomeIdempotencyKey("org-1", "evt-1"),
  "learning-outcome:org-1:evt-1",
)
assert.equal(
  buildLearningInsightIdempotencyKey({
    organizationId: "org-1",
    insightType: "approval_friction",
    generatedFromWindow: "2026-06-27",
  }),
  "learning-insight:org-1:approval_friction:2026-06-27",
)
assert.equal(resolveLearningInsightWindow("2026-06-27T15:00:00.000Z"), "2026-06-27")

const emptyReadModel = synthesizeEmptyClosedLoopLearningReadModel({
  generatedAt: "2026-06-27T12:00:00.000Z",
  schemaReady: false,
})
assert.equal(emptyReadModel.schemaReady, false)
assert.equal(emptyReadModel.persistenceMode, "empty")
assert.equal(emptyReadModel.outcomes.length, 0)

process.env.GROWTH_LEARNING_IN_MEMORY_STORE = "1"
const inMemoryReadModel = buildGrowthClosedLoopLearningReadModel({
  organizationId: "org-test",
  generatedAt: "2026-06-27T12:00:00.000Z",
})
assert.equal(inMemoryReadModel.persistenceMode, "in_memory_test")

const revenueEnriched = enrichRevenueDirectorWithLearningInsights({
  revenueDirector: {
    readOnly: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: "rule",
    rankingFormula: "formula",
    executiveSummary: {
      revenueHealth: "on_pace",
      onPace: true,
      primaryFocus: null,
      headline: "test",
      shouldPauseOutbound: false,
      shouldIntervene: false,
    },
    objectiveHealth: [],
    kpis: {
      approvalBacklog: 0,
      activeAutonomousScopes: 0,
      blockedAutonomousScopes: 0,
      activeMissions: 0,
      stalledMissions: 0,
      humanReviewRequired: 0,
      communicationPlansGenerated: 0,
      eventBusHealthy: true,
    },
    resourceAllocation: {
      topObjectiveId: null,
      topObjectiveTitle: null,
      starvedBindingCount: 0,
      outboundActionsToday: 0,
      outboundDailyLimit: null,
      communicationTopChannel: null,
    },
    workflowRequests: [],
    bottlenecks: [],
    risks: [],
    escalations: [],
    recommendations: [],
    health: {
      agentHealthStatus: "healthy",
      eventBusStatus: "healthy",
      autonomyStatus: "enabled",
    },
    eventObservation: {
      subscriberId: "revenue_director_observer",
      eventsReceived: 0,
      lastEventType: null,
    },
  },
  learning: {
    ...inMemoryReadModel,
    insights: [mappedInsight],
    outcomes: [mappedOutcome],
  },
})
assert.ok(revenueEnriched.learningAdvisory)

const communicationEnriched = enrichCommunicationEngineWithLearningInsights({
  communicationEngine: {
    readOnly: true,
    qaMarker: GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: "rule",
    rankingFormula: "formula",
    summary: {
      plansGenerated: 1,
      primaryStrategy: "email_first",
      blockedChannelCount: 0,
      averageConfidence: 80,
      topChannel: "email",
    },
    plans: [],
  },
  learning: {
    ...inMemoryReadModel,
    insights: [mappedInsight],
  },
})
assert.equal(communicationEnriched.readOnly, true)

delete process.env.GROWTH_LEARNING_IN_MEMORY_STORE

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-closed-loop-learning-section.tsx")
assert.ok(ui.includes("Store mode"))
assert.equal(ui.includes("Apply"), false)

console.log("[GE-AI-3D-PROD-1] Static certification passed — running GE-AI-3D regression")
execSync("pnpm test:ge-ai-3d-closed-loop-learning-foundation", {
  stdio: "inherit",
  timeout: 15 * 60 * 1000,
})

console.log("[GE-AI-3D-PROD-1] Durable Closed-Loop Learning Store certification PASSED")
