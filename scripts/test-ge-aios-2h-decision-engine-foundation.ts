/**
 * GE-AIOS-2H — Decision Engine foundation certification.
 * Run: pnpm test:ge-aios-2h-decision-engine-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  calculateDecisionEngineConfidence,
  isDecisionEngineEvidenceSufficient,
} from "../lib/growth/aios/ai-decision-engine-confidence"
import { calculateDecisionEngineCost } from "../lib/growth/aios/ai-decision-engine-cost"
import { collectAiDecisionEngineEvidence } from "../lib/growth/aios/ai-decision-engine-evidence-collector"
import { evaluateAiDecisionEngineRules } from "../lib/growth/aios/ai-decision-engine-evaluator"
import { aiDecisionEngineSchemaCatalog } from "../lib/growth/aios/ai-decision-engine-repository"
import { buildDecisionEngineRecommendation } from "../lib/growth/aios/ai-decision-engine-recommendation"
import { calculateDecisionEngineRisk } from "../lib/growth/aios/ai-decision-engine-risk"
import {
  AI_DECISION_ENGINE_RUNTIME_RULE,
  GROWTH_AIOS_2H_PHASE,
  GROWTH_AI_DECISION_ENGINE_QA_MARKER,
  GROWTH_AI_DECISION_ENGINE_SCHEMA_MIGRATION,
  resolveDecisionConfidenceBand,
} from "../lib/growth/aios/ai-decision-engine-types"
import { resolveDecisionKeyForWorkOrderType } from "../lib/growth/aios/ai-decision-engine-work-order-binding"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import type { AiWorkOrder } from "../lib/growth/aios/ai-work-order-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleWorkOrder(overrides: Partial<AiWorkOrder> = {}): AiWorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    missionId: "mission-1",
    ownerAgent: "executive_brain",
    assignedAgent: "qualification",
    workOrderType: "verify_email",
    entityType: "lead",
    entityId: "lead-1",
    priority: 500,
    status: "awaiting_decision",
    decisionRecordIds: [],
    memoryRefs: [],
    payload: { email: "test@example.com", domain: "example.com" },
    dependsOn: [],
    retryCount: 0,
    maxRetries: 3,
    timeoutAt: null,
    executionWindowStart: null,
    executionWindowEnd: null,
    approvalId: null,
    checkpoint: null,
    requestedBy: null,
    result: null,
    failureReason: null,
    auditMetadata: {},
    issuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    qaMarker: "growth-aios-2a-ai-work-order-v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_2H_PHASE}] Decision Engine foundation certification`)

assert.equal(GROWTH_AI_DECISION_ENGINE_QA_MARKER, "growth-aios-2h-decision-engine-v1")
assert.equal(GROWTH_AI_DECISION_ENGINE_SCHEMA_MIGRATION, "20271001180000_growth_aios_2h_decision_engine.sql")
assert.equal(resolveDecisionKeyForWorkOrderType("verify_email"), "verify_email")
assert.equal(resolveDecisionKeyForWorkOrderType("research_company"), "enrich_company")

const evidence = collectAiDecisionEngineEvidence({
  workOrderPayload: { email: "test@example.com", note: "verified domain match" },
  memoryRefs: [{ memoryType: "lead", memoryId: "mem-1", sourceSystem: "lead_memory", sourceTable: "growth.lead_memory_profiles" }],
})
assert.ok(evidence.length >= 2)

const confidence = calculateDecisionEngineConfidence(evidence)
assert.ok(confidence >= 45)
assert.equal(isDecisionEngineEvidenceSufficient(confidence), true)
assert.equal(resolveDecisionConfidenceBand(confidence), confidence >= 85 ? "high" : "medium")

const risk = calculateDecisionEngineRisk({
  decisionKey: "verify_email",
  confidence,
  evidence,
})
assert.ok(risk >= 0 && risk <= 100)

assert.equal(calculateDecisionEngineCost("verify_email"), 0.01)

const recommendation = buildDecisionEngineRecommendation({
  decisionKey: "verify_email",
  workOrderType: "verify_email",
  confidence,
  riskScore: risk,
  sufficientEvidence: true,
})
assert.equal(recommendation.proceed, true)

const insufficientEval = evaluateAiDecisionEngineRules({
  workOrder: sampleWorkOrder({ payload: {} }),
  evidenceInput: { workOrderPayload: {}, memoryRefs: [] },
})
assert.equal(insufficientEval.requestStatus, "insufficient_evidence")
assert.equal(insufficientEval.decisionKey, "insufficient_evidence")

const sufficientEval = evaluateAiDecisionEngineRules({
  workOrder: sampleWorkOrder(),
  evidenceInput: {
    workOrderPayload: sampleWorkOrder().payload,
    memoryRefs: [{ memoryType: "lead", memoryId: "mem-1", sourceTable: "growth.lead_memory_profiles" }],
  },
})
assert.equal(sufficientEval.requestStatus, "evaluated")
assert.equal(sufficientEval.decisionKey, "verify_email")

const migration = readSource(`supabase/migrations/${GROWTH_AI_DECISION_ENGINE_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("ai_decision_engine_runtime"))
assert.ok(migration.includes("ai_decision_engine_requests"))
assert.equal(migration.includes("openai"), false)

const serviceSource = readSource("lib/growth/aios/ai-decision-engine-service.ts")
for (const pattern of [
  "openai",
  "anthropic",
  "runAiTask",
  "claimAiOsWorkOrder",
  "delegateAiExecutiveWorkOrder",
  "computeGrowthLeadNextBestAction",
  "recomputeGrowthLeadNextBestAction",
  "apollo",
  "pdl",
]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern.toLowerCase()), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("createAiDecisionRecord"))
assert.ok(serviceSource.includes("fetchAiMemoryRegistryById"))
assert.ok(serviceSource.includes("decision.evaluated"))

const engineFiles = [
  "lib/growth/aios/ai-decision-engine-types.ts",
  "lib/growth/aios/ai-decision-engine-work-order-binding.ts",
  "lib/growth/aios/ai-decision-engine-evidence-collector.ts",
  "lib/growth/aios/ai-decision-engine-confidence.ts",
  "lib/growth/aios/ai-decision-engine-risk.ts",
  "lib/growth/aios/ai-decision-engine-cost.ts",
  "lib/growth/aios/ai-decision-engine-recommendation.ts",
  "lib/growth/aios/ai-decision-engine-evaluator.ts",
  "lib/growth/aios/ai-decision-engine-repository.ts",
  "lib/growth/aios/ai-decision-engine-service.ts",
  "lib/growth/aios/ai-decision-engine-health.ts",
  "lib/growth/aios/ai-decision-engine-schema-health.ts",
]
for (const file of engineFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_DECISION_ENGINE_RUNTIME_RULE.includes("does not execute"))
assert.ok(lookupAiEventRegistryEntry("decision.evaluated"))
assert.ok(lookupAiEventRegistryEntry("decision.engine_degraded"))
assert.equal(aiDecisionEngineSchemaCatalog().qaMarker, GROWTH_AI_DECISION_ENGINE_QA_MARKER)

console.log(`[${GROWTH_AIOS_2H_PHASE}] PASS — Decision Engine foundation certified (local)`)
