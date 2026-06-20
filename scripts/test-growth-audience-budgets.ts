/**
 * GS-RG-2A — Audience budget integration certification (local static).
 * Run: pnpm test:growth-audience-budgets
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS } from "../lib/growth/audiences/growth-audience-config"
import {
  GROWTH_RUNTIME_DAILY_BUDGET_CAPS,
  GROWTH_RUNTIME_GUARDRAIL_LIMITS,
  GROWTH_RUNTIME_HOURLY_BUDGET_CAPS,
  getBudgetCapForResource,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2A Audience Budget Certification ===\n")

  assert.equal(getBudgetCapForResource("audience_generations", "hourly"), 10)
  assert.equal(getBudgetCapForResource("audience_refreshes", "daily"), 20)
  assert.equal(
    GROWTH_RUNTIME_HOURLY_BUDGET_CAPS.audience_generations,
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_GENERATIONS_PER_HOUR,
  )
  assert.equal(
    GROWTH_RUNTIME_DAILY_BUDGET_CAPS.audience_refreshes,
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY,
  )

  const guardrails = readSource("lib/growth/audiences/growth-audience-guardrails.ts")
  assert.match(guardrails, /consumeBudget/)
  assert.match(guardrails, /consumeUserBudget/)

  const snapshot = readSource("lib/growth/audiences/growth-audience-snapshot-service.ts")
  assert.match(snapshot, /consumeAudienceGenerationBudget/)
  assert.match(snapshot, /consumeAudienceSearchPageBudget/)

  console.log("  Runtime protection answers:")
  console.log(`    maxReadsPerRun: ~${GROWTH_AUDIENCE_LIMITS.SNAPSHOT_SEARCH_PAGE_SIZE} per batch + bounded pages`)
  console.log(`    maxWritesPerRun: ${GROWTH_AUDIENCE_LIMITS.SNAPSHOT_MEMBER_INSERT_BATCH} per insert chunk`)
  console.log(`    maxMembers: ${GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT}`)
  console.log(`    generations/hour: ${GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_GENERATIONS_PER_HOUR}`)
  console.log(`    refreshes/day: ${GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY}`)
  console.log("    killSwitch: audience_snapshot_enabled")

  console.log("\nGS-RG-2A audience budget certification passed.\n")
}

main()
