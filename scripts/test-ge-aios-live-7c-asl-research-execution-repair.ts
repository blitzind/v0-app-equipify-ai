/**
 * GE-AIOS-LIVE-7C — Autonomous Sales Loop delegation wiring repair (local architecture cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-live-7c-asl-research-execution-repair.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER } from "../lib/growth/specialists/execution/execute-sales-workflow-agent"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const executeAgent = fs.readFileSync(
  path.join(root, "lib/growth/specialists/execution/execute-sales-workflow-agent.ts"),
  "utf8",
)
const orchestrator = fs.readFileSync(
  path.join(root, "lib/growth/research/research-orchestrator.ts"),
  "utf8",
)

console.log("GE-AIOS-LIVE-7C — ASL delegation research execution repair cert\n")

assert.match(executeAgent, /GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER/)
console.log("  ✓ LIVE-7C QA marker exported")

assert.match(executeAgent, /const \{ workflow_agent: workflowAgent \} = delegation/)
console.log("  ✓ workflow_agent resolved from input.delegation")

assert.doesNotMatch(
  executeAgent,
  /const \{ workflow_agent: workflowAgent, workItem \} = input/,
)
console.log("  ✓ removed incorrect destructuring from input root")

assert.match(executeAgent, /case "research_agent":/)
assert.match(executeAgent, /executeGrowthLeadProspectResearch/)
console.log("  ✓ research_agent still routes to executeGrowthLeadProspectResearch")

assert.match(orchestrator, /finalizeProspectResearchCompletion/)
assert.match(orchestrator, /cached: true/)
console.log("  ✓ LIVE-7B cache-hit reconciliation path unchanged")

assert.match(orchestrator, /if \(!rebuild\)/)
assert.match(orchestrator, /fetchActiveProspectResearchRun/)
console.log("  ✓ cache reuse + duplicate prevention unchanged")

assert.equal(
  GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER,
  "ge-aios-live-7c-asl-delegation-research-execution-repair-v1",
)
console.log("  ✓ QA marker constant matches expected slug")

console.log("\nGE-AIOS-LIVE-7C local architecture cert passed.")
