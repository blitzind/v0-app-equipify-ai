/**
 * FUZOR-ADOPTION-1H — Memory platform delegation parity.
 * Run: pnpm test:fuzor-adoption-1h-memory-platform-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_MEMORY_ENGINE_QA_MARKER,
  PLATFORM_ORGANIZATIONAL_MEMORY_STORAGE_KEY,
  PLATFORM_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  PLATFORM_MEMORY_REGISTRY_QA_MARKER,
  PLATFORM_SALES_SPECIALIST_MEMORY_SOURCE,
  detectPlatformMemoryPatterns,
  runPlatformMemoryEngine,
} from "@fuzor/memory"

import {
  AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY,
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  detectMemoryPatterns,
  runMemoryEngine,
} from "../lib/growth/memory"

import {
  GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
} from "../lib/growth/memory/knowledge/organization-knowledge-types"

import {
  GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
} from "../lib/growth/aios/ai-memory-registry-types"

import {
  SALES_SPECIALIST_MEMORY_SOURCE,
  extractSalesOutcomeMemoryEvents,
} from "../lib/growth/specialists/execution/sales-specialist-memory-bridge"

import {
  fetchOrganizationMemoryStore,
  upsertOrganizationMemoryEvents,
} from "../lib/growth/memory/storage/organization-memory-repository"

import {
  registerAiMemoryRegistryEntry,
  queryAiMemoryRegistry,
} from "../lib/growth/aios/ai-memory-registry-service"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1H] Memory platform delegation parity")

assert.strictEqual(GROWTH_MEMORY_ENGINE_QA_MARKER, PLATFORM_MEMORY_ENGINE_QA_MARKER)
assert.strictEqual(AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY, PLATFORM_ORGANIZATIONAL_MEMORY_STORAGE_KEY)
assert.strictEqual(GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER, PLATFORM_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER)
assert.strictEqual(GROWTH_AI_MEMORY_REGISTRY_QA_MARKER, PLATFORM_MEMORY_REGISTRY_QA_MARKER)
assert.strictEqual(SALES_SPECIALIST_MEMORY_SOURCE, PLATFORM_SALES_SPECIALIST_MEMORY_SOURCE)
assert.strictEqual(detectMemoryPatterns, detectPlatformMemoryPatterns)

const engineInput = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  generatedAt: "2026-07-22T12:00:00.000Z",
  workspaceSummary: {
    kpis: {
      emailsSentToday: 0,
      repliesToday: 0,
      callsToday: 0,
      openOpportunities: 0,
      hotCompanies: 0,
      approvalQueueCount: 0,
    },
    meetings: { today: 0, thisWeek: 0, scheduled: 0 },
    inbox: { repliesNeedingAttention: 0, threadsOpen: 0, newReplies: 0 },
    operatorTasks: { callTasksDue: 0, pendingApprovals: 0, leadsNeedingAction: 0 },
    avaConsole: {
      greeting: "Good morning.",
      overnightSummary: null,
      highPriorityOpportunities: null,
      waitingForApproval: null,
      suggestedNextAction: "Continue researching.",
      researchLoopSummary: null,
    },
    dashboard: {
      generatedAt: "2026-07-22T12:00:00.000Z",
      briefing: null,
      sections: [],
      operatorActionCards: [],
      dailyRevenueWorkQueueEnabled: false,
      dailyRevenueWorkQueue: null,
      dailyRevenueWorkQueueDisplay: null,
    },
  },
  waitingOnYou: [],
  dailyWorkQueue: [],
  accomplishments: [],
  timeline: [],
}

const platformResult = runPlatformMemoryEngine(engineInput)
const wrapperResult = runMemoryEngine(engineInput)
assert.deepEqual(wrapperResult.summary.qaMarker, platformResult.summary.qaMarker)
assert.equal(wrapperResult.store.organizationId, platformResult.store.organizationId)

const engine = readSource("lib/growth/memory/engine/run-memory-engine.ts")
assert.ok(engine.includes("@fuzor/memory"))
assert.ok(!engine.includes("detectMemoryPatterns("))

const repository = readSource("lib/growth/memory/storage/organization-memory-repository.ts")
assert.ok(repository.includes("@fuzor/memory"))
assert.ok(!repository.includes('.from("organization_memory_events")'))

const registry = readSource("lib/growth/aios/ai-memory-registry-service.ts")
assert.ok(registry.includes("@fuzor/memory"))

assert.strictEqual(typeof fetchOrganizationMemoryStore, "function")
assert.strictEqual(typeof upsertOrganizationMemoryEvents, "function")
assert.strictEqual(typeof registerAiMemoryRegistryEntry, "function")
assert.strictEqual(typeof queryAiMemoryRegistry, "function")
assert.strictEqual(typeof extractSalesOutcomeMemoryEvents, "function")

console.log("[FUZOR-ADOPTION-1H] wrapper delegation verified")

const EQUIPIFY_ORG = "00000000-0000-4000-8000-000000000001"
const INSIDEIFY_ORG = "00000000-0000-4000-8000-000000000002"
const FUTURE_ORG = "00000000-0000-4000-8000-000000000003"

for (const orgId of [EQUIPIFY_ORG, INSIDEIFY_ORG, FUTURE_ORG]) {
  const result = runMemoryEngine({ ...engineInput, organizationId: orgId })
  assert.equal(result.store.organizationId, orgId)
}

assert.equal(engine.includes("workflow"), false)
assert.equal(engine.includes("DataMoon"), false)
assert.equal(registry.includes("campaign"), false)

console.log("[FUZOR-ADOPTION-1H] multi-product memory architecture proof")

console.log("[FUZOR-ADOPTION-1H] PASS")
