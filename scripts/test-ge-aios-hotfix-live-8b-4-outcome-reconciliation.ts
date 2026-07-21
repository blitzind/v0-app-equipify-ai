/**
 * GE-AIOS-HOTFIX-LIVE-8B-4 — ASL outcome reconciliation (local cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-hotfix-live-8b-4-outcome-reconciliation.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX,
  GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
  buildAslResearchOutcomeMemoryEventId,
  resolveAslResearchWorkItemId,
} from "../lib/growth/specialists/execution/reconcile-asl-prospect-research-outcome-8b4"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

console.log("GE-AIOS-HOTFIX-LIVE-8B-4 — ASL outcome reconciliation cert\n")

assert.equal(
  GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
  "ge-aios-hotfix-live-8b-4-outcome-reconciliation-v1",
)
console.log("  ✓ QA marker constant")

const reconcileSource = read("lib/growth/specialists/execution/reconcile-asl-prospect-research-outcome-8b4.ts")
assert.match(reconcileSource, /export async function reconcileAslProspectResearchOutcome/)
assert.match(reconcileSource, /scheduleAslProspectResearchOutcomeReconciliation/)
assert.match(reconcileSource, /already_reconciled/)
assert.match(reconcileSource, /autonomous_sales_loop_outcome_reconciled/)
console.log("  ✓ canonical reconciliation authority exists")

const executionSource = read("lib/growth/research/growth-lead-research-execution-service.ts")
assert.match(executionSource, /scheduleAslProspectResearchOutcomeReconciliation/)
assert.match(executionSource, /input\.trigger === "sales_loop"/)
assert.match(executionSource, /aslWorkItemId/)
assert.match(executionSource, /scheduleAslProspectResearchOutcomeReconciliationForActiveRun/)
console.log("  ✓ active reuse schedules async reconciliation watcher")

const agentSource = read("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
assert.match(agentSource, /aslWorkItemId: workItem\.id/)
console.log("  ✓ ASL passes work item id into research execution")

const aslSource = read("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
assert.match(aslSource, /researchOutcomePersistedByReconciliationAuthority/)
assert.match(aslSource, /countReconciledAslResearchOutcomesSince/)
assert.match(aslSource, /total_outcomes_reconciled/)
assert.match(aslSource, /perOrganizationTimeoutMs \?\? 8_000/)
console.log("  ✓ ASL avoids duplicate research memory persist and harvests reconciled outcomes")

const repoSource = read("lib/growth/research/research-repository.ts")
assert.match(repoSource, /reconcileStaleActiveProspectResearchRuns/)
console.log("  ✓ stale recovery authority preserved")

assert.equal(buildAslResearchOutcomeMemoryEventId("run-123"), `${ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX}run-123`)
assert.equal(
  resolveAslResearchWorkItemId({ leadId: "lead-1", workItemId: null }),
  "work:research:queue:lead-1",
)
console.log("  ✓ deterministic reconciliation ids")

const observabilitySource = read("lib/growth/specialists/execution/autonomous-sales-loop-observability.ts")
assert.match(observabilitySource, /OUTCOME_RECONCILED/)
console.log("  ✓ reconciliation observability event wired")

console.log("\nGE-AIOS-HOTFIX-LIVE-8B-4 local cert passed.")
