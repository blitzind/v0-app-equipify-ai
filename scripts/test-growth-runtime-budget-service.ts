/**
 * GS-RG-1 — runtime budget service regression checks.
 * Run: pnpm test:growth-runtime-budget-service
 */
import assert from "node:assert/strict"
import {
  evaluateBudgetAllowance,
  resolveBudgetWindowStart,
  shouldRollBudgetWindow,
} from "../lib/growth/runtime-guardrails/growth-runtime-budget-window"
import { getBudgetCapForResource } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

async function main(): Promise<void> {
  const hourlyStart = resolveBudgetWindowStart("hourly", Date.parse("2026-06-19T14:30:00.000Z"))
  assert.equal(hourlyStart, "2026-06-19T14:00:00.000Z")

  const dailyStart = resolveBudgetWindowStart("daily", Date.parse("2026-06-19T14:30:00.000Z"))
  assert.equal(dailyStart, "2026-06-19T00:00:00.000Z")

  assert.equal(shouldRollBudgetWindow("hourly", hourlyStart, Date.parse("2026-06-19T15:00:01.000Z")), true)
  assert.equal(shouldRollBudgetWindow("hourly", hourlyStart, Date.parse("2026-06-19T14:30:00.000Z")), false)

  const allowed = evaluateBudgetAllowance({ currentCount: 10, cap: 100, volume: 1 })
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.remaining, 89)

  const blocked = evaluateBudgetAllowance({ currentCount: 100, cap: 100, volume: 1 })
  assert.equal(blocked.allowed, false)

  assert.ok(getBudgetCapForResource("searches", "hourly") > 0)
  assert.ok(getBudgetCapForResource("enrichments", "daily") > 0)

  console.log("GS-RG-1 runtime budget service regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
