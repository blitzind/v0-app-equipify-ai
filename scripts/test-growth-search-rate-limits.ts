/**
 * GS-RG-1 — prospect search rate limit regression checks.
 * Run: pnpm test:growth-search-rate-limits
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
  truncateSearchResults,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.ok(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_SEARCHES_PER_HOUR > 0)
  assert.ok(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_ESTIMATE_CALLS_PER_HOUR > 0)
  assert.ok(GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_REFRESH_CALLS_PER_HOUR > 0)

  const limiter = readSource("lib/growth/runtime-guardrails/growth-search-rate-limiter.ts")
  assert.match(limiter, /recordProspectSearchAudit/)
  assert.match(limiter, /withProspectSearchGuardrails/)
  assert.match(limiter, /rows_returned/)
  assert.match(limiter, /duration_ms/)

  const searchRoute = readSource("app/api/platform/growth/prospect-search/route.ts")
  assert.match(searchRoute, /withProspectSearchGuardrails/)

  const estimateRoute = readSource("app/api/platform/growth/prospect-search/estimate/route.ts")
  assert.match(estimateRoute, /withProspectSearchGuardrails/)

  const truncated = truncateSearchResults([1, 2, 3])
  assert.deepEqual(truncated.rows, [1, 2, 3])
  assert.equal(truncated.truncated, false)

  console.log("GS-RG-1 search rate limit regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
