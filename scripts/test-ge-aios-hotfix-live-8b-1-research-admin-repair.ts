/**
 * GE-AIOS-HOTFIX-LIVE-8B-1 — ASL research admin client repair (local architecture cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-hotfix-live-8b-1-research-admin-repair.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AIOS_HOTFIX_LIVE_8B_1_RESEARCH_ADMIN_REPAIR_QA_MARKER,
  GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER,
} from "../lib/growth/specialists/execution/execute-sales-workflow-agent"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const source = fs.readFileSync(
  path.join(root, "lib/growth/specialists/execution/execute-sales-workflow-agent.ts"),
  "utf8",
)

console.log("GE-AIOS-HOTFIX-LIVE-8B-1 — research admin runtime repair cert\n")

assert.equal(
  GE_AIOS_HOTFIX_LIVE_8B_1_RESEARCH_ADMIN_REPAIR_QA_MARKER,
  "ge-aios-hotfix-live-8b-1-research-admin-repair-v1",
)
console.log("  ✓ HOTFIX-LIVE-8B-1 QA marker exported")

assert.match(source, /GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER/)
assert.match(source, /const \{ workflow_agent: workflowAgent \} = delegation/)
console.log("  ✓ LIVE-7C delegation wiring preserved")

assert.match(source, /executeGrowthLeadProspectResearch\(\{\s*\n\s*admin,/)
assert.doesNotMatch(source, /admin: input\.admin/)
console.log("  ✓ research_agent passes function admin param (not undefined input.admin)")

console.log("\nGE-AIOS-HOTFIX-LIVE-8B-1 local architecture cert passed.")
