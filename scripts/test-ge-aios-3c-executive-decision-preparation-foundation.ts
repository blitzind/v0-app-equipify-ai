/**
 * GE-AIOS-3C — Executive Decision Preparation certification.
 * Run: pnpm test:ge-aios-3c-executive-decision-preparation-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_EXECUTIVE_DECISION_PREPARATION_RUNTIME_RULE,
  GROWTH_AIOS_3C_PHASE,
  GROWTH_AI_EXECUTIVE_DECISION_PREPARATION_QA_MARKER,
} from "../lib/growth/aios/ai-executive-decision-preparation-types"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_3C_PHASE}] Executive Decision Preparation certification`)

assert.equal(GROWTH_AI_EXECUTIVE_DECISION_PREPARATION_QA_MARKER, "growth-aios-3c-executive-decision-preparation-v1")

const prepSource = readSource("lib/growth/aios/ai-executive-decision-preparation-service.ts")
assert.ok(prepSource.includes("runAiDecisionEngineForWorkOrder"))
assert.ok(prepSource.includes("enableAiEvidence"))
assert.ok(prepSource.includes("executive.decision_preparation_started"))
assert.ok(prepSource.includes("executive.decision_prepared"))
assert.ok(prepSource.includes("executive.decision_preparation_failed"))
for (const pattern of ["claimAiOsWorkOrder", "invokeAiOsProviderWithContextPackage", "getProviderAdapter", "executing"]) {
  assert.equal(prepSource.includes(pattern), false, `preparation service must not reference ${pattern}`)
}

const executiveSource = readSource("lib/growth/aios/ai-executive-brain-service.ts")
assert.ok(executiveSource.includes("prepareDecision"))
assert.ok(executiveSource.includes("prepareExecutiveDecisionForWorkOrder"))
assert.equal(executiveSource.includes("claimAiOsWorkOrder"), false)
assert.equal(executiveSource.includes('toStatus: "executing"'), false)
assert.equal(executiveSource.includes("invokeAiOsProviderWithContextPackage"), false)

const typesSource = readSource("lib/growth/aios/ai-executive-brain-types.ts")
assert.ok(typesSource.includes("prepareDecision"))
assert.ok(typesSource.includes("enableAiEvidence"))

const agentSource = readSource("lib/growth/aios/ai-agent-runtime-service.ts")
assert.ok(agentSource.includes("transitionAiWorkOrder"))

const bridgeSource = readSource("lib/growth/aios/ai-decision-execution-bridge-service.ts")
assert.ok(bridgeSource.includes("prepareAiWorkOrderForExecutionViaDecisionBridge"))

const prepFiles = [
  "lib/growth/aios/ai-executive-decision-preparation-types.ts",
  "lib/growth/aios/ai-executive-decision-preparation-service.ts",
]
for (const file of prepFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_EXECUTIVE_DECISION_PREPARATION_RUNTIME_RULE.includes("does not transition to executing"))
assert.ok(lookupAiEventRegistryEntry("executive.decision_preparation_started"))
assert.ok(lookupAiEventRegistryEntry("executive.decision_prepared"))
assert.ok(lookupAiEventRegistryEntry("executive.decision_preparation_failed"))

console.log(`[${GROWTH_AIOS_3C_PHASE}] PASS — Executive Decision Preparation certified (local)`)
