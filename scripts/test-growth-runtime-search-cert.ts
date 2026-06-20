/**
 * GS-RG-1C — Search guardrail certification scenarios.
 * Run: pnpm test:growth-runtime-search-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "../lib/growth/runtime-guardrails/growth-runtime-budget-window"
import {
  getBudgetCapForResource,
  getUserBudgetCapForResource,
} from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type Scenario = {
  name: string
  currentCount: number
  cap: number
  volume: number
  expectAllowed: boolean
}

function simulate429(scenario: Scenario): { status: number; allowed: boolean } {
  const result = evaluateBudgetAllowance({
    currentCount: scenario.currentCount,
    cap: scenario.cap,
    volume: scenario.volume,
  })
  return { allowed: result.allowed, status: result.allowed ? 200 : 429 }
}

function main(): void {
  console.log("\n=== GS-RG-1C Search Guardrail Certification ===\n")

  const limiter = readSource("lib/growth/runtime-guardrails/growth-search-rate-limiter.ts")
  assert.match(limiter, /consumeUserBudget/)
  assert.match(limiter, /remainingUserBudget/)
  assert.match(limiter, /blockedBy/)

  const orgCap = getBudgetCapForResource("searches", "hourly")
  const userCap = getUserBudgetCapForResource("searches", "hourly")
  assert.ok(orgCap >= userCap)

  const scenarios: Scenario[] = [
    { name: "normal traffic", currentCount: 10, cap: orgCap, volume: 1, expectAllowed: true },
    { name: "near org limit", currentCount: orgCap - 1, cap: orgCap, volume: 1, expectAllowed: true },
    { name: "over org limit", currentCount: orgCap, cap: orgCap, volume: 1, expectAllowed: false },
    { name: "over user limit", currentCount: userCap, cap: userCap, volume: 1, expectAllowed: false },
  ]

  for (const scenario of scenarios) {
    const result = simulate429(scenario)
    assert.equal(result.allowed, scenario.expectAllowed, scenario.name)
    console.log(`  ✓ ${scenario.name}: ${result.status}`)
  }

  const windowStart = resolveBudgetWindowStart("hourly")
  assert.equal(shouldRollBudgetWindow("hourly", windowStart, Date.now() + 3_600_001), true)
  console.log("  ✓ reset window: hourly roll resets budget")

  console.log("\nGS-RG-1C search certification passed.\n")
}

main()
