/** GE-AIOS-RUNTIME-THROUGHPUT-1A — wiring smoke test (local). */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const loop = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
const presenter = readSource("lib/growth/home/growth-home-runtime-trust-presenter-1b.ts")
const loader = readSource("lib/growth/home/growth-home-canonical-runtime-activity-loader-1a.ts")
const select = readSource("lib/growth/specialists/execution/select-next-executable-work-item.ts")

assert.match(loop, /AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS/)
assert.match(loop, /skippedWorkItemIds/)
assert.match(loop, /perWorkItemTimeoutMs/)
assert.match(presenter, /resolveLastAutonomousActivity/)
assert.match(presenter, /telemetryStale/)
assert.match(presenter, /stale:/)
assert.match(loader, /research_runs/)
assert.match(select, /excludeWorkItemIds/)

console.log("GE-AIOS-RUNTIME-THROUGHPUT-1A wiring smoke test passed")
