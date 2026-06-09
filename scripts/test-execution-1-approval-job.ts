/**
 * Execution-1 approval job certification structure.
 * Run: pnpm test:execution-1-approval-job
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const PRODUCTION_CERT = "scripts/certify-execution-1-approval-job-production.ts"
const DASHBOARD_ROUTE = "app/api/platform/growth/sequences/execution/dashboard/route.ts"
const APPROVE_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/approve/route.ts"
const QUEUE_JOB = "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts"
const SAFE_DASHBOARD = "components/growth/growth-sequence-safe-execution-dashboard.tsx"

const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const HENRY_SCHEIN_ENROLLMENT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"

for (const relativePath of [PRODUCTION_CERT, DASHBOARD_ROUTE, APPROVE_ROUTE, QUEUE_JOB, SAFE_DASHBOARD]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const productionCert = fs.readFileSync(path.join(process.cwd(), PRODUCTION_CERT), "utf8")
const queueJob = fs.readFileSync(path.join(process.cwd(), QUEUE_JOB), "utf8")
const safeDashboard = fs.readFileSync(path.join(process.cwd(), SAFE_DASHBOARD), "utf8")

assert.match(productionCert, new RegExp(HENRY_SCHEIN_LEAD_ID))
assert.match(productionCert, new RegExp(HENRY_SCHEIN_ENROLLMENT_ID))
assert.match(productionCert, /pending_approval/)
assert.match(productionCert, /fetchGrowthSequenceSafeExecutionDashboard/)
console.log("  ✓ production cert — Henry Schein fixtures + dashboard visibility checks")

assert.match(queueJob, /status: "pending_approval"/)
assert.match(queueJob, /adapter send skipped/)
assert.doesNotMatch(queueJob, /status: "sent"/)
console.log("  ✓ transport job planner — pending_approval only, no adapter send")

assert.match(safeDashboard, /pending_approval/)
assert.match(safeDashboard, /jobAction/)
assert.match(safeDashboard, /data-sequence-action="approve"/)
console.log("  ✓ execution dashboard UI — approve action for pending jobs")

console.log("\nExecution-1 approval job structure certification passed.")
