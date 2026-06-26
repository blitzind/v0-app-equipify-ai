/**
 * GE-AIOS-2I — Decision Engine execution bridge certification.
 * Run: pnpm test:ge-aios-2i-decision-execution-bridge-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { AiDecisionRecord } from "../lib/growth/aios/ai-decision-record-types"
import {
  AI_DECISION_EXECUTION_BRIDGE_RUNTIME_RULE,
  AI_DECISION_EXECUTION_MIN_CONFIDENCE,
  GROWTH_AIOS_2I_PHASE,
  GROWTH_AI_DECISION_EXECUTION_BRIDGE_QA_MARKER,
  hasExecutableDecisionRecords,
  isExecutableDecisionRecord,
  shouldBlockForInsufficientExistingRecords,
  shouldInvokeDecisionEngineForGateResult,
} from "../lib/growth/aios/ai-decision-execution-bridge-types"
import { validateAiWorkOrderDecisionGate } from "../lib/growth/aios/ai-decision-gate-validator"
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
    payload: { email: "test@example.com" },
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

function sampleDecisionRecord(overrides: Partial<AiDecisionRecord> = {}): AiDecisionRecord {
  return {
    id: "dr-1",
    organizationId: "org-1",
    missionId: "mission-1",
    workOrderId: "wo-1",
    decisionKey: "verify_email",
    ownerAgent: "qualification",
    entityType: "lead",
    entityId: "lead-1",
    evidenceBundle: [{ evidenceKey: "lead.email" }],
    confidence: 80,
    riskScore: 10,
    expectedCostUsd: 0.01,
    expectedRoi: null,
    expectedValueUsd: null,
    explanation: "Test decision",
    chosenAction: { actionKey: "verify" },
    rejectedActions: [],
    outcome: null,
    operatorOverride: null,
    learning: {},
    supersedesDecisionId: null,
    schemaVersion: "1.0",
    auditMetadata: {},
    qaMarker: "growth-aios-2d-decision-record-v1",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_2I_PHASE}] Decision Engine execution bridge certification`)

assert.equal(GROWTH_AI_DECISION_EXECUTION_BRIDGE_QA_MARKER, "growth-aios-2i-decision-execution-bridge-v1")
assert.equal(AI_DECISION_EXECUTION_MIN_CONFIDENCE, 45)

assert.equal(isExecutableDecisionRecord(sampleDecisionRecord()), true)
assert.equal(isExecutableDecisionRecord(sampleDecisionRecord({ decisionKey: "insufficient_evidence" })), false)
assert.equal(isExecutableDecisionRecord(sampleDecisionRecord({ confidence: 44 })), false)
assert.equal(hasExecutableDecisionRecords([sampleDecisionRecord({ confidence: 44 })]), false)
assert.equal(hasExecutableDecisionRecords([sampleDecisionRecord()]), true)

const missingGate = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder(),
  decisionRecords: [],
})
assert.equal(shouldInvokeDecisionEngineForGateResult(missingGate), true)

const validGate = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord()],
})
assert.equal(shouldInvokeDecisionEngineForGateResult(validGate), false)
if (validGate.passed) {
  assert.equal(shouldBlockForInsufficientExistingRecords(validGate), false)
}

const insufficientOnlyGate = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ decisionKey: "insufficient_evidence", confidence: 30 })],
})
assert.equal(insufficientOnlyGate.passed, true)
if (insufficientOnlyGate.passed) {
  assert.equal(shouldBlockForInsufficientExistingRecords(insufficientOnlyGate), true)
}

const missionMismatchGate = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ missionId: "mission-other" })],
})
assert.equal(shouldInvokeDecisionEngineForGateResult(missionMismatchGate), false)

const bridgeFiles = [
  "lib/growth/aios/ai-decision-execution-bridge-types.ts",
  "lib/growth/aios/ai-decision-execution-bridge-service.ts",
]
for (const file of bridgeFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

const bridgeServiceSource = readSource("lib/growth/aios/ai-decision-execution-bridge-service.ts")
for (const pattern of [
  "openai",
  "anthropic",
  "apollo",
  "pdl",
  "llm",
  "claimAiOsWorkOrder",
  "delegateAiExecutiveWorkOrder",
  "computeGrowthLeadNextBestAction",
]) {
  assert.equal(bridgeServiceSource.toLowerCase().includes(pattern.toLowerCase()), false, `bridge service must not reference ${pattern}`)
}
assert.ok(bridgeServiceSource.includes("runAiDecisionEngineForWorkOrder"))
assert.ok(bridgeServiceSource.includes("assertAiWorkOrderDecisionGateForExecution"))
assert.ok(bridgeServiceSource.includes("decision.engine_invoked"))
assert.ok(bridgeServiceSource.includes("decision.engine_skipped_existing_record"))
assert.ok(bridgeServiceSource.includes("decision.engine_blocked_execution"))
assert.ok(bridgeServiceSource.includes("decision.execution_bridge_completed"))
assert.ok(bridgeServiceSource.includes("fetchAiDecisionEngineRuntime"))

const workOrderServiceSource = readSource("lib/growth/aios/ai-work-order-service.ts")
assert.ok(workOrderServiceSource.includes("prepareAiWorkOrderForExecutionViaDecisionBridge"))
assert.equal(workOrderServiceSource.includes("assertAiWorkOrderDecisionGateForExecution"), false)

const agentRuntimeSource = readSource("lib/growth/aios/ai-agent-runtime-service.ts")
assert.ok(agentRuntimeSource.includes("transitionAiWorkOrder"))
assert.equal(agentRuntimeSource.includes("prepareAiWorkOrderForExecutionViaDecisionBridge"), false)

assert.ok(AI_DECISION_EXECUTION_BRIDGE_RUNTIME_RULE.includes("does not execute"))
assert.ok(lookupAiEventRegistryEntry("decision.engine_invoked"))
assert.ok(lookupAiEventRegistryEntry("decision.engine_skipped_existing_record"))
assert.ok(lookupAiEventRegistryEntry("decision.engine_blocked_execution"))
assert.ok(lookupAiEventRegistryEntry("decision.execution_bridge_completed"))

console.log(`[${GROWTH_AIOS_2I_PHASE}] PASS — Decision Engine execution bridge certified (local)`)
