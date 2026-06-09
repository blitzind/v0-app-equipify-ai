/**
 * Execution-2 approval readiness structure certification.
 * Run: pnpm test:execution-2-approval-readiness
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const PRODUCTION_CERT = "scripts/certify-execution-2-approval-readiness-production.ts"
const APPROVE_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/approve/route.ts"
const SKIP_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/skip/route.ts"
const RESTORE_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/restore/route.ts"
const RUN_ROUTE = "app/api/platform/growth/sequences/execution/jobs/[jobId]/run/route.ts"
const JOB_RUNNER = "lib/growth/sequences/execution/sequence-job-runner.ts"

const HENRY_SCHEIN_JOB_ID = "4d765ebd-c635-471c-8231-b0eb10b6a555"

for (const relativePath of [PRODUCTION_CERT, APPROVE_ROUTE, SKIP_ROUTE, RESTORE_ROUTE, RUN_ROUTE, JOB_RUNNER]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const jobRunner = fs.readFileSync(path.join(process.cwd(), JOB_RUNNER), "utf8")
const approveRoute = fs.readFileSync(path.join(process.cwd(), APPROVE_ROUTE), "utf8")
const productionCert = fs.readFileSync(path.join(process.cwd(), PRODUCTION_CERT), "utf8")

assert.match(jobRunner, /status: "approved"/)
assert.match(jobRunner, /send still requires explicit run/)
assert.match(productionCert, new RegExp(HENRY_SCHEIN_JOB_ID))
assert.match(productionCert, /rollback_paths/)
assert.match(approveRoute, /approveSequenceExecutionJob/)
assert.doesNotMatch(approveRoute, /runSequenceExecutionJob/)
console.log("  ✓ approve path — job approval without run/send in approve route")

console.log("\nExecution-2 approval readiness structure certification passed.")
