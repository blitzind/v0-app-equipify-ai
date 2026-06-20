/**
 * GS-RG-2A — Manual refresh certification (local static).
 * Run: pnpm test:growth-audience-refresh
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS } from "../lib/growth/audiences/growth-audience-config"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2A Audience Refresh Certification ===\n")

  assert.equal(
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY,
    GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY,
  )

  const refreshRoute = readSource("app/api/platform/growth/audiences/[audienceId]/refresh/route.ts")
  assert.match(refreshRoute, /isRefresh: true/)
  assert.match(refreshRoute, /continueAudienceSnapshotGeneration/)

  const guardrails = readSource("lib/growth/audiences/growth-audience-guardrails.ts")
  assert.match(guardrails, /consumeAudienceRefreshBudget/)
  assert.match(guardrails, /audience_snapshot_enabled/)

  const repo = readSource("lib/growth/audiences/growth-audience-repository.ts")
  assert.match(repo, /members_added/)
  assert.match(repo, /members_removed/)
  assert.match(repo, /rows_read/)
  assert.match(repo, /rows_written/)

  const detail = readSource("components/growth/audiences/growth-audience-detail.tsx")
  assert.match(detail, /Refresh Audience/)
  assert.doesNotMatch(detail, /setInterval/)

  console.log("  ✓ Manual refresh only — operator button, budgets, metrics")
  console.log("\nGS-RG-2A audience refresh certification passed.\n")
}

main()
