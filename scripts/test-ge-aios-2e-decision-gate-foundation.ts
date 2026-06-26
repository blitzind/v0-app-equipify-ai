/**
 * GE-AIOS-2E — Decision Gate for Work Orders certification.
 * Run: pnpm test:ge-aios-2e-decision-gate-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { AiDecisionRecord } from "../lib/growth/aios/ai-decision-record-types"
import {
  AI_DECISION_GATE_RUNTIME_RULE,
  GROWTH_AIOS_2E_PHASE,
  GROWTH_AI_DECISION_GATE_QA_MARKER,
  resolveDecisionGateBlockedWorkOrderStatus,
} from "../lib/growth/aios/ai-decision-gate-types"
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
    ownerAgent: "research",
    assignedAgent: "research",
    workOrderType: "research_company",
    entityType: "company",
    entityId: "company-1",
    priority: 500,
    status: "awaiting_decision",
    decisionRecordIds: [],
    memoryRefs: [],
    payload: {},
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
    entityType: "company",
    entityId: "company-1",
    evidenceBundle: [{ evidenceKey: "lead.score" }],
    confidence: 80,
    riskScore: 10,
    expectedCostUsd: 0,
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

console.log(`[${GROWTH_AIOS_2E_PHASE}] Decision Gate foundation certification`)

assert.equal(GROWTH_AI_DECISION_GATE_QA_MARKER, "growth-aios-2e-decision-gate-v1")

const missing = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder(),
  decisionRecords: [],
})
assert.equal(missing.passed, false)
if (!missing.passed) {
  assert.equal(missing.blockReason, "missing_decision_records")
}

const valid = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord()],
})
assert.equal(valid.passed, true)
if (valid.passed) {
  assert.equal(valid.decisionRecords.length, 1)
}

const notFound = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-missing"] }),
  decisionRecords: [],
})
assert.equal(notFound.passed, false)
if (!notFound.passed) {
  assert.equal(notFound.blockReason, "decision_record_not_found")
}

const crossOrg = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ organizationId: "org-other" })],
})
assert.equal(crossOrg.passed, false)
if (!crossOrg.passed) {
  assert.equal(crossOrg.blockReason, "cross_organization")
}

const missionMismatch = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ missionId: "mission-other" })],
})
assert.equal(missionMismatch.passed, false)
if (!missionMismatch.passed) {
  assert.equal(missionMismatch.blockReason, "mission_mismatch")
}

const workOrderMismatch = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ workOrderId: "wo-other" })],
})
assert.equal(workOrderMismatch.passed, false)
if (!workOrderMismatch.passed) {
  assert.equal(workOrderMismatch.blockReason, "work_order_mismatch")
}

const entityMismatch = validateAiWorkOrderDecisionGate({
  workOrder: sampleWorkOrder({ decisionRecordIds: ["dr-1"] }),
  decisionRecords: [sampleDecisionRecord({ entityId: "company-other" })],
})
assert.equal(entityMismatch.passed, false)
if (!entityMismatch.passed) {
  assert.equal(entityMismatch.blockReason, "entity_mismatch")
}

assert.equal(resolveDecisionGateBlockedWorkOrderStatus("awaiting_decision"), null)
assert.equal(resolveDecisionGateBlockedWorkOrderStatus("awaiting_approval"), "awaiting_decision")
assert.equal(resolveDecisionGateBlockedWorkOrderStatus("waiting"), "escalated")

const gateFiles = [
  "lib/growth/aios/ai-decision-gate-types.ts",
  "lib/growth/aios/ai-decision-gate-validator.ts",
  "lib/growth/aios/ai-decision-gate-service.ts",
]
for (const file of gateFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

const serviceSource = readSource("lib/growth/aios/ai-decision-gate-service.ts")
for (const pattern of ["openai", "anthropic", "apollo", "pdl", "llm", "createAiDecisionRecord", "executive-brain"]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern.toLowerCase()), false, `gate service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("decision.gate_passed"))
assert.ok(serviceSource.includes("decision.gate_blocked"))
assert.equal(serviceSource.includes("createAiDecisionRecord"), false)

const workOrderServiceSource = readSource("lib/growth/aios/ai-work-order-service.ts")
assert.ok(workOrderServiceSource.includes("prepareAiWorkOrderForExecutionViaDecisionBridge"))
assert.ok(workOrderServiceSource.includes('input.toStatus === "executing"'))

const agentRuntimeSource = readSource("lib/growth/aios/ai-agent-runtime-service.ts")
assert.ok(agentRuntimeSource.includes("transitionAiWorkOrder"))
assert.equal(agentRuntimeSource.includes("createAiDecisionRecord"), false)

assert.ok(AI_DECISION_GATE_RUNTIME_RULE.includes("does not invoke AI"))
assert.ok(lookupAiEventRegistryEntry("decision.gate_passed"))
assert.ok(lookupAiEventRegistryEntry("decision.gate_blocked"))

console.log(`[${GROWTH_AIOS_2E_PHASE}] PASS — Decision Gate foundation certified (local)`)
