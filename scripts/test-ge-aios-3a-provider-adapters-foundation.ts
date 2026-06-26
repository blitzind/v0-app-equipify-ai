/**
 * GE-AIOS-3A — LLM Provider Abstraction certification.
 * Run: pnpm test:ge-aios-3a-provider-adapters-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAiOsProviderMessagesFromContextPackage } from "../lib/growth/aios/ai-provider-context-prompt"
import { normalizeAiOsProviderResponse } from "../lib/growth/aios/ai-provider-normalizer"
import { aiOsModelCapabilityCatalog, lookupAiOsModelCapability } from "../lib/growth/aios/ai-provider-model-registry"
import {
  AI_OS_PROVIDER_REGISTRY,
  aiOsProviderRegistryCatalog,
  lookupAiOsProviderRegistryEntry,
} from "../lib/growth/aios/ai-provider-registry"
import { aiProviderSchemaCatalog } from "../lib/growth/aios/ai-provider-repository"
import { selectAiOsProviderCandidates } from "../lib/growth/aios/ai-provider-selection-service"
import {
  AI_OS_PROVIDER_IDS,
  AI_OS_PROVIDER_RUNTIME_RULE,
  GROWTH_AIOS_3A_PHASE,
  GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER,
  GROWTH_AI_PROVIDER_ADAPTERS_SCHEMA_MIGRATION,
} from "../lib/growth/aios/ai-provider-types"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import type { AiContextPackage } from "../lib/growth/aios/ai-context-assembly-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleContextPackage(): AiContextPackage {
  return {
    id: "ctx-1",
    organizationId: "org-1",
    missionId: "mission-1",
    workOrderId: "wo-1",
    contextVersion: "1.0",
    checksum: "abc123",
    workOrderContext: {
      workOrderId: "wo-1",
      missionId: "mission-1",
      workOrderType: "verify_email",
      status: "awaiting_decision",
      ownerAgent: "qualification",
      assignedAgent: "qualification",
      entityType: "lead",
      entityId: "lead-1",
      priority: 500,
      payload: { email: "test@example.com" },
      decisionRecordIds: [],
      memoryRefIds: [],
    },
    missionContext: null,
    decisionHistory: [],
    memoryReferences: [],
    relatedEvents: [],
    evidenceBundle: [{ evidenceKey: "lead.email", snippet: "test@example.com" }],
    entityMetadata: null,
    sourceKeys: ["work_order"],
    reusedFromPackageId: null,
    qaMarker: "growth-aios-2j-context-assembly-v1",
    createdAt: new Date().toISOString(),
  }
}

console.log(`[${GROWTH_AIOS_3A_PHASE}] LLM Provider Abstraction certification`)

assert.equal(GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER, "growth-aios-3a-provider-adapters-v1")
assert.equal(GROWTH_AI_PROVIDER_ADAPTERS_SCHEMA_MIGRATION, "20271001200000_growth_aios_3a_provider_adapters.sql")
assert.equal(AI_OS_PROVIDER_IDS.length, 3)
assert.equal(AI_OS_PROVIDER_REGISTRY.length, 3)
assert.ok(aiOsProviderRegistryCatalog().count === 3)
assert.ok(aiOsModelCapabilityCatalog().count >= 9)
assert.ok(lookupAiOsProviderRegistryEntry("openai"))
assert.ok(lookupAiOsModelCapability("openai", "fast"))

const messages = buildAiOsProviderMessagesFromContextPackage({
  contextPackage: sampleContextPackage(),
  purpose: "decision_support",
})
assert.equal(messages.length, 2)
assert.ok(messages[1].content?.toString().includes("wo-1"))

const normalized = normalizeAiOsProviderResponse({
  providerId: "openai",
  modelId: "gpt-4o-mini",
  raw: { text: "  hello  ", promptTokens: 10, completionTokens: 5, finishReason: "stop" },
})
assert.equal(normalized.text, "hello")
assert.equal(normalized.providerId, "openai")
assert.ok(normalized.usage.estimatedCostUsd >= 0)

const candidates = selectAiOsProviderCandidates({ modelTier: "balanced" })
assert.ok(Array.isArray(candidates))

const migration = readSource(`supabase/migrations/${GROWTH_AI_PROVIDER_ADAPTERS_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("ai_provider_runtime"))
assert.ok(migration.includes("ai_provider_requests"))

const bridgeSource = readSource("lib/growth/aios/ai-provider-core-bridge.ts")
assert.ok(bridgeSource.includes("getProviderAdapter"))
assert.equal(bridgeSource.includes("new OpenAI"), false)

const serviceSource = readSource("lib/growth/aios/ai-provider-service.ts")
assert.ok(serviceSource.includes("invokeAiOsProviderWithContextPackage"))
assert.ok(serviceSource.includes("buildAiOsProviderMessagesFromContextPackage"))
assert.ok(serviceSource.includes("invokeAiOsProviderWithFailover"))
assert.ok(serviceSource.includes("ai.requested"))
assert.ok(serviceSource.includes("ai.completed"))
assert.ok(serviceSource.includes("ai.failed"))
assert.equal(serviceSource.includes("getProviderAdapter"), false)
assert.equal(serviceSource.includes("runAiTask"), false)

const providerFiles = [
  "lib/growth/aios/ai-provider-types.ts",
  "lib/growth/aios/ai-provider-registry.ts",
  "lib/growth/aios/ai-provider-model-registry.ts",
  "lib/growth/aios/ai-provider-context-prompt.ts",
  "lib/growth/aios/ai-provider-normalizer.ts",
  "lib/growth/aios/ai-provider-selection-service.ts",
  "lib/growth/aios/ai-provider-failover.ts",
  "lib/growth/aios/ai-provider-repository.ts",
  "lib/growth/aios/ai-provider-service.ts",
  "lib/growth/aios/ai-provider-health.ts",
  "lib/growth/aios/ai-provider-schema-health.ts",
]
for (const file of providerFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

const forbiddenDirectProviderPatterns = ["openai", "anthropic", "@anthropic-ai", "generativelanguage", "runAiTask"]
const aiosGuardedFiles = [
  "lib/growth/aios/ai-decision-engine-service.ts",
  "lib/growth/aios/ai-executive-brain-service.ts",
  "lib/growth/aios/ai-decision-execution-bridge-service.ts",
  "lib/growth/aios/ai-context-assembly-service.ts",
  "lib/growth/aios/ai-provider-service.ts",
]
for (const file of aiosGuardedFiles) {
  const source = readSource(file).toLowerCase()
  for (const pattern of forbiddenDirectProviderPatterns) {
    assert.equal(source.includes(pattern.toLowerCase()), false, `${file} must not reference ${pattern}`)
  }
}

assert.ok(AI_OS_PROVIDER_RUNTIME_RULE.includes("never call providers directly"))
assert.ok(lookupAiEventRegistryEntry("ai.requested"))
assert.ok(lookupAiEventRegistryEntry("ai.completed"))
assert.ok(lookupAiEventRegistryEntry("ai.failed"))
assert.ok(lookupAiEventRegistryEntry("ai.provider_degraded"))
assert.ok(lookupAiEventRegistryEntry("ai.provider_switched"))
assert.equal(aiProviderSchemaCatalog().qaMarker, GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER)

console.log(`[${GROWTH_AIOS_3A_PHASE}] PASS — LLM Provider Abstraction certified (local)`)
