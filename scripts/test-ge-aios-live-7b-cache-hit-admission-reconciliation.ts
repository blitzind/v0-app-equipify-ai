/**
 * GE-AIOS-LIVE-7B — Cache-hit post-research admission reconciliation (local architecture cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-live-7b-cache-hit-admission-reconciliation.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER,
} from "../lib/growth/research/research-orchestrator"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const orchestrator = fs.readFileSync(
  path.join(root, "lib/growth/research/research-orchestrator.ts"),
  "utf8",
)

console.log("GE-AIOS-LIVE-7B — cache-hit admission reconciliation architecture cert\n")

assert.match(orchestrator, /GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER/)
console.log("  ✓ LIVE-7B QA marker exported from research orchestrator")

assert.match(orchestrator, /async function finalizeProspectResearchCompletion/)
console.log("  ✓ shared finalizeProspectResearchCompletion helper present")

assert.match(orchestrator, /finalizeProspectResearchCompletion\([\s\S]*cached: true/)
console.log("  ✓ cache-hit path invokes post-research completion pipeline")

assert.match(
  orchestrator,
  /if \(cached\.status === "completed"\)[\s\S]*finalizeProspectResearchCompletion/,
)
console.log("  ✓ completed cache hits reconcile before return")

assert.doesNotMatch(
  orchestrator,
  /logProspectResearch\("cache_hit"[\s\S]{0,120}return \{ ok: true, run: cached, cached: true, lead \}/,
)
console.log("  ✓ cache-hit no longer returns before reconciliation")

assert.match(orchestrator, /finalizeProspectResearchCompletion\([\s\S]*cached: false/)
console.log("  ✓ fresh research path uses same completion helper")

assert.match(orchestrator, /fetchCachedProspectResearchRun/)
assert.match(orchestrator, /if \(!rebuild\)/)
console.log("  ✓ cache reuse + rebuild bypass unchanged")

assert.match(orchestrator, /fetchActiveProspectResearchRun/)
assert.match(orchestrator, /duplicate_blocked/)
console.log("  ✓ duplicate research prevention unchanged")

assert.match(orchestrator, /reconcileExternalDiscoveryPostResearchAdmission/)
assert.match(orchestrator, /markLeadProspectResearchCompleted/)
assert.match(orchestrator, /recomputeGrowthLeadWorkflowSignals/)
console.log("  ✓ post-research reconciliation + persistence hooks preserved")

assert.equal(
  GROWTH_RESEARCH_CACHE_HIT_POST_RECONCILE_7B_QA_MARKER,
  "ge-aios-live-7b-cache-hit-post-research-reconcile-v1",
)
console.log("  ✓ QA marker constant matches expected slug")

console.log("\nGE-AIOS-LIVE-7B local architecture cert passed.")
