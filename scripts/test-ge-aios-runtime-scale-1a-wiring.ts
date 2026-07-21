/** GE-AIOS-RUNTIME-SCALE-1A — wiring smoke test (local). */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const loop = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
const scale = readSource("lib/growth/specialists/execution/growth-runtime-scale-1a.ts")
const repo = readSource("lib/growth/research/research-repository.ts")

assert.match(loop, /collectResearchWorkBatch/)
assert.match(loop, /AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS_SCALE_1A/)
assert.match(scale, /GROWTH_ORG_RESEARCH_TARGET_PER_DAY = 500/)
assert.match(repo, /countOrganizationActiveProspectResearchRuns/)
assert.match(repo, /\.eq\("status", "queued"\)/)

console.log("GE-AIOS-RUNTIME-SCALE-1A wiring smoke test passed")
