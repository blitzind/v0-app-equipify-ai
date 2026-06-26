/**
 * GE-AIOS-3B — AI Decision Intelligence Bridge certification.
 * Run: pnpm test:ge-aios-3b-decision-intelligence-bridge-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_DECISION_INTELLIGENCE_BRIDGE_RUNTIME_RULE,
  AI_DECISION_INTELLIGENCE_EVIDENCE_TRUST,
  buildAiDecisionEvidenceFromProviderResponse,
  GROWTH_AIOS_3B_PHASE,
  GROWTH_AI_DECISION_INTELLIGENCE_BRIDGE_QA_MARKER,
} from "../lib/growth/aios/ai-decision-intelligence-bridge-types"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import type { AiOsProviderNormalizedResponse } from "../lib/growth/aios/ai-provider-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleProviderResponse(): AiOsProviderNormalizedResponse {
  return {
    text: "Lead email domain matches company website. Recommend proceed with verification.",
    finishReason: "stop",
    providerId: "openai",
    modelId: "gpt-4o-mini",
    usage: { promptTokens: 100, completionTokens: 20, estimatedCostUsd: 0.001 },
    failoverCount: 0,
    attemptedProviders: ["openai"],
  }
}

console.log(`[${GROWTH_AIOS_3B_PHASE}] AI Decision Intelligence Bridge certification`)

assert.equal(GROWTH_AI_DECISION_INTELLIGENCE_BRIDGE_QA_MARKER, "growth-aios-3b-decision-intelligence-bridge-v1")
assert.equal(AI_DECISION_INTELLIGENCE_EVIDENCE_TRUST, 55)

const evidence = buildAiDecisionEvidenceFromProviderResponse({
  response: sampleProviderResponse(),
  contextPackageId: "ctx-1",
  providerRequestId: "req-1",
})
assert.equal(evidence.length, 1)
assert.equal(evidence[0].evidenceKey, "ai_provider.intelligence")
assert.equal(evidence[0].metadata?.advisory_only, true)
assert.equal(evidence[0].metadata?.authoritative, false)

const bridgeSource = readSource("lib/growth/aios/ai-decision-intelligence-bridge-service.ts")
assert.ok(bridgeSource.includes("assembleAiContextForWorkOrder"))
assert.ok(bridgeSource.includes("invokeAiOsProviderWithContextPackage"))
assert.ok(bridgeSource.includes("decision.ai_context_requested"))
assert.ok(bridgeSource.includes("decision.ai_evidence_added"))
assert.ok(bridgeSource.includes("decision.ai_evidence_failed"))
assert.ok(bridgeSource.includes("fallback: \"rule_only\""))
for (const pattern of ["getProviderAdapter", "runAiTask", "openai", "anthropic", "apollo"]) {
  assert.equal(bridgeSource.toLowerCase().includes(pattern.toLowerCase()), false, `bridge must not reference ${pattern}`)
}

const engineSource = readSource("lib/growth/aios/ai-decision-engine-service.ts")
assert.ok(engineSource.includes("collectOptionalAiDecisionEvidence"))
assert.ok(engineSource.includes("enableAiEvidence"))
assert.ok(engineSource.includes("aiEnrichment.aiEvidence"))
assert.equal(engineSource.includes("invokeAiOsProviderWithContextPackage"), false)
assert.equal(engineSource.includes("getProviderAdapter"), false)

const bridgeFiles = [
  "lib/growth/aios/ai-decision-intelligence-bridge-types.ts",
  "lib/growth/aios/ai-decision-intelligence-bridge-service.ts",
]
for (const file of bridgeFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_DECISION_INTELLIGENCE_BRIDGE_RUNTIME_RULE.includes("deterministic"))
assert.ok(lookupAiEventRegistryEntry("decision.ai_context_requested"))
assert.ok(lookupAiEventRegistryEntry("decision.ai_evidence_added"))
assert.ok(lookupAiEventRegistryEntry("decision.ai_evidence_failed"))

console.log(`[${GROWTH_AIOS_3B_PHASE}] PASS — AI Decision Intelligence Bridge certified (local)`)
