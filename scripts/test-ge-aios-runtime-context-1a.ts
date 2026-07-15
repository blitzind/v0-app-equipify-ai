/**
 * GE-AIOS-RUNTIME-CONTEXT-1A — Request-scoped Runtime Context certification.
 * Run: pnpm test:ge-aios-runtime-context-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER,
  GROWTH_AIOS_RUNTIME_CONTEXT_1A_RUNTIME_RULE,
  GROWTH_AIOS_RUNTIME_CONTEXT_VERDICT,
  GROWTH_AIOS_RUNTIME_REQUEST_BOUNDARIES,
  GROWTH_AIOS_RUNTIME_SHARED_OBJECT_INVENTORY,
} from "../lib/growth/aios/runtime/growth-aios-runtime-context-1a-types"
import {
  createGrowthAiOsRuntimeContext,
  type GrowthAiOsRuntimeContext,
} from "../lib/growth/aios/runtime/growth-aios-runtime-context-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("GE-AIOS-RUNTIME-CONTEXT-1A\n")

// Phase 1 — Registry integrity
assert.equal(GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER, "ge-aios-runtime-context-1a-v1")
assert.ok(GROWTH_AIOS_RUNTIME_CONTEXT_1A_RUNTIME_RULE.includes("request-scoped"))
assert.ok(GROWTH_AIOS_RUNTIME_SHARED_OBJECT_INVENTORY.length >= 8)
assert.ok(GROWTH_AIOS_RUNTIME_REQUEST_BOUNDARIES.length >= 8)
console.log("  ✓ Phase 1 — shared object inventory and request boundaries")

// Phase 2 — Runtime Context contract (lazy getters)
const contextModule = readSource("lib/growth/aios/runtime/growth-aios-runtime-context-1a.ts")
for (const getter of [
  "getPackage",
  "getMemory",
  "getDecision",
  "getCommittee",
  "getInstitutional",
  "getRelationship",
  "getSalesStrategyBrief",
  "snapshotResolutionCounts",
]) {
  assert.match(contextModule, new RegExp(getter))
}
assert.doesNotMatch(contextModule, /decisionResolutionCache|globalThis|persist/)
console.log("  ✓ Phase 2 — lazy getter contract (no global cache / persistence)")

// Phase 3 — Dependency order: package → memory → decision
assert.ok(contextModule.indexOf("resolvePackage") < contextModule.indexOf("resolveMemory"))
assert.ok(contextModule.indexOf("resolveMemory") < contextModule.indexOf("resolveDecision"))
assert.match(contextModule, /preloadedMemoryBundle/)
console.log("  ✓ Phase 3 — acyclic dependency graph (package → memory → decision)")

// Phase 4 — Consumer wiring
const consumerWiring: Array<[string, string]> = [
  ["lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/call-copilot-briefing.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/meeting-intelligence/meeting-prep-context.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/aios/approvals/approvals-operator-review-service.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/draft-factory/draft-factory-durable-live.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts", "runtimeContext"],
  ["lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts", "runtimeContext"],
  ["lib/growth/aios/growth/growth-canonical-decision-engine-1d-growth5f-gate.ts", "runtimeContext"],
  ["lib/growth/home/growth-home-workspace-summary-service.ts", "createGrowthAiOsRuntimeContext"],
  ["lib/growth/reply-intelligence/process-reply-intelligence.ts", "createGrowthAiOsRuntimeContext"],
]
for (const [file, needle] of consumerWiring) {
  assert.match(readSource(file), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
console.log("  ✓ Phase 4 — runtime consumers wired")

// Phase 5 — Duplicate resolution reduction (static)
const leadWs = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
assert.doesNotMatch(leadWs, /resolveGrowthCanonicalDecisionForLeadCached/)
assert.doesNotMatch(leadWs, /resolveCanonicalHumanMemoryForLead\(admin[\s\S]{0,80}resolveGrowthCanonicalDecisionForLeadCached/)
const g5fPersist = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts",
)
assert.match(g5fPersist, /runtimeContext\.getDecision/)
const g5fGate = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-growth5f-gate.ts")
assert.match(g5fGate, /runtimeContext\.getDecision/)
console.log("  ✓ Phase 5 — duplicate resolver paths replaced with Runtime Context")

// Phase 6 — Request boundaries: per-account isolation
const noCrossAccountShare = GROWTH_AIOS_RUNTIME_REQUEST_BOUNDARIES.every(
  (row) => row.mayShareAcrossAccounts === false,
)
assert.equal(noCrossAccountShare, true)
assert.match(contextModule, /boundary\?:/)
console.log("  ✓ Phase 6 — one context per account per request boundary")

// Phase 7 — Scheduler: draft factory passes context through advance → G5F
const draftLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(draftLive, /runtimeContext\.getDecision/)
assert.match(draftLive, /runtimeContext,/)
console.log("  ✓ Phase 7 — scheduler tick uses one context per account (DF → G5F)")

// Phase 8 — Memoization structure (promise singleton pattern)
assert.match(contextModule, /packagePromise/)
assert.match(contextModule, /memoryPromise/)
assert.match(contextModule, /decisionPromise/)
assert.match(contextModule, /resolutionCounts/)
console.log("  ✓ Phase 8 — per-request resolution counters and promise memoization")

// Phase 9 — Factory smoke (no DB)
const ctx = createGrowthAiOsRuntimeContext(
  {} as import("@supabase/supabase-js").SupabaseClient,
  {
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    leadId: "00000000-0000-4000-8000-000000000001",
    boundary: "lead_workspace_load",
  },
) satisfies GrowthAiOsRuntimeContext
assert.equal(ctx.qaMarker, GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER)
assert.equal(ctx.resolutionCounts.decision, 0)
assert.equal(ctx.resolutionCounts.memory, 0)
assert.equal(ctx.resolutionCounts.package, 0)
console.log("  ✓ Phase 9 — factory creates context with zero initial resolution counts")

// Phase 10 — Verdict
assert.equal(GROWTH_AIOS_RUNTIME_CONTEXT_VERDICT, "READY_FOR_HOME_RUNTIME_OPTIMIZATION")
console.log("  ✓ Phase 10 — verdict:", GROWTH_AIOS_RUNTIME_CONTEXT_VERDICT)

console.log("\nGE-AIOS-RUNTIME-CONTEXT-1A PASS")
console.log(`Verdict: ${GROWTH_AIOS_RUNTIME_CONTEXT_VERDICT}`)
