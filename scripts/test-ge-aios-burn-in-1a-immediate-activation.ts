/**
 * GE-AIOS-BURN-IN-1A — Immediate activation wiring smoke test (local).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const activationService = readSource("lib/growth/ava-activation/growth-ava-activation-service.ts")
const immediateTick = readSource("lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a.ts")
const activateRoute = readSource("app/api/growth/workspace/ava/activate/route.ts")

assert.match(activationService, /runGrowthAvaActivationImmediateProductionTick/)
assert.match(immediateTick, /runGrowthObjectiveRuntimeScheduler/)
assert.match(activateRoute, /immediateTick/)
assert.match(readSource("components/growth/workspace/executive-briefing/growth-home-ava-activation-section.tsx"), /immediateTick/)

console.log("GE-AIOS-BURN-IN-1A immediate activation wiring smoke test passed")
